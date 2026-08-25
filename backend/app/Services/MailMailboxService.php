<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserMailCredential;
use App\Models\UserMailRecipientSuggestion;
use App\Support\AppSettings;
use Illuminate\Http\UploadedFile;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Mail;
use IMAP\Connection;
use RuntimeException;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;
use Throwable;

class MailMailboxService
{
    public const FOLDER_INBOX = 'inbox';

    public const FOLDER_DRAFTS = 'drafts';

    public const FOLDER_SENT = 'sent';

    public const FOLDER_SPAM = 'spam';

    public const FOLDER_ARCHIVE = 'archive';

    /**
     * @return array<int, string>
     */
    public static function logicalFolders(): array
    {
        return [
            self::FOLDER_INBOX,
            self::FOLDER_DRAFTS,
            self::FOLDER_SENT,
            self::FOLDER_SPAM,
            self::FOLDER_ARCHIVE,
        ];
    }

    /**
     * @return array{host: string, port: int, encryption: string|null, smtp_port: int, smtp_encryption: string|null}
     */
    public function serverConfig(?User $user = null, ?string $mailboxEmail = null): array
    {
        $settings = AppSettings::row();
        $host = $this->resolveMailHost($settings, $user, $mailboxEmail);

        if ($host === '') {
            throw new RuntimeException('Mail server is not configured. Ask an admin to set SMTP/IMAP settings.');
        }

        return [
            'host' => $host,
            'port' => (int) ($settings->imap_port ?? 993),
            'encryption' => $settings->imap_encryption ?: 'ssl',
            'smtp_port' => (int) ($settings->smtp_port ?? 587),
            'smtp_encryption' => $settings->smtp_encryption ?: 'tls',
        ];
    }

    protected function resolveMailHost(?object $settings, ?User $user = null, ?string $mailboxEmail = null): string
    {
        $configured = trim((string) (($settings->imap_host ?? '') ?: ($settings->smtp_host ?? '')));

        // Admin-configured hosts are used as-is. DNS probes here can hang for
        // tens of seconds on macOS and take down php artisan serve.
        if ($configured !== '') {
            return rtrim($configured, '.');
        }

        $candidates = [];
        $emailForDomain = $mailboxEmail ?: $user?->email;
        if ($emailForDomain) {
            $domain = $this->domainFromEmail($emailForDomain);
            if ($domain) {
                $candidates[] = 'mail.'.$domain;

                $mxHost = $this->mxHostForDomain($domain);
                if ($mxHost) {
                    $candidates[] = $mxHost;
                }
            }
        }

        $candidates = array_values(array_unique(array_filter($candidates)));

        foreach ($candidates as $candidate) {
            if ($this->hostResolves($candidate)) {
                return rtrim($candidate, '.');
            }
        }

        return '';
    }

    protected function domainFromEmail(string $email): ?string
    {
        $parts = explode('@', strtolower(trim($email)));

        return $parts[1] ?? null;
    }

    protected function mxHostForDomain(string $domain): ?string
    {
        $records = @dns_get_record($domain, DNS_MX);

        if (! is_array($records) || $records === []) {
            return null;
        }

        usort($records, fn (array $a, array $b) => ($a['pri'] ?? 0) <=> ($b['pri'] ?? 0));

        $target = trim((string) ($records[0]['target'] ?? ''));

        return $target !== '' ? rtrim($target, '.') : null;
    }

    protected function hostResolves(string $host): bool
    {
        $host = rtrim(trim($host), '.');

        if ($host === '') {
            return false;
        }

        if (filter_var($host, FILTER_VALIDATE_IP)) {
            return true;
        }

        $cacheKey = 'mail.host_resolves.'.strtolower($host);
        $cached = Cache::get($cacheKey);
        if (is_bool($cached)) {
            return $cached;
        }

        $records = @dns_get_record($host, DNS_A + DNS_AAAA + DNS_CNAME);
        $resolved = is_array($records) && $records !== [];
        Cache::put($cacheKey, $resolved, $resolved ? 300 : 60);

        return $resolved;
    }

    public function isImapEnabled(): bool
    {
        if (! config('mail.imap.enabled')) {
            return false;
        }

        return function_exists('imap_open');
    }

    protected function ensureImapAvailable(): void
    {
        if ($this->isImapEnabled()) {
            return;
        }

        if (! config('mail.imap.enabled')) {
            throw new RuntimeException('IMAP is disabled.');
        }

        throw new RuntimeException('PHP IMAP extension is not installed on the server.');
    }

    public function isServerConfigured(): bool
    {
        if (! $this->isImapEnabled()) {
            return false;
        }

        $settings = AppSettings::row();

        return trim((string) ($settings->imap_host ?? $settings->smtp_host ?? '')) !== '';
    }

    public function isServerReachableForUser(User $user): bool
    {
        if (! $this->isServerConfigured()) {
            return false;
        }

        try {
            $this->serverConfig($user);

            return true;
        } catch (RuntimeException) {
            return false;
        }
    }

    public function hasCredentials(User $user): bool
    {
        return UserMailCredential::query()
            ->where('user_id', $user->id)
            ->exists();
    }

    /**
     * @return \Illuminate\Support\Collection<int, UserMailCredential>
     */
    public function accountsFor(User $user)
    {
        return UserMailCredential::query()
            ->where('user_id', $user->id)
            ->orderByDesc('is_primary')
            ->orderBy('email')
            ->get();
    }

    public function resolveAccount(User $user, ?int $accountId = null): UserMailCredential
    {
        $query = UserMailCredential::query()->where('user_id', $user->id);

        if ($accountId) {
            $credential = (clone $query)->where('id', $accountId)->first();

            if (! $credential) {
                throw new RuntimeException('Mail account not found.');
            }

            return $credential;
        }

        $credential = (clone $query)->where('is_primary', true)->first()
            ?? (clone $query)->orderBy('id')->first();

        if (! $credential) {
            throw new RuntimeException('Mail account not connected.');
        }

        return $credential;
    }

    /**
     * @return resource|Connection
     */
    public function connect(User $user, ?int $accountId = null, string $folder = self::FOLDER_INBOX)
    {
        $credential = $this->resolveAccount($user, $accountId);

        $this->ensureImapAvailable();

        $password = $this->decryptMailboxPassword($credential);
        $config = $this->serverConfig($user, $credential->email);
        $logicalFolder = $this->normalizeLogicalFolder($folder);

        $previous = imap_errors();
        if (is_array($previous)) {
            imap_errors();
        }

        $connection = $this->openMailbox($this->mailboxString($config, 'INBOX'), $credential->email, $password);

        $map = $this->discoverFolderMapFromConnection($connection, $config);
        $this->folderMapCache[$credential->id] = $map;

        $imapFolder = $map[$logicalFolder] ?? $this->defaultImapFolder($logicalFolder);

        if ($imapFolder !== 'INBOX') {
            $target = $this->mailboxString($config, $imapFolder);
            if (! @imap_reopen($connection, $target)) {
                $error = imap_last_error() ?: "Could not open folder \"{$logicalFolder}\".";
                imap_close($connection);
                throw new RuntimeException($error);
            }
        }

        return $connection;
    }

    public function testAndStoreCredentials(User $user, string $password, ?string $email = null, ?string $label = null): UserMailCredential
    {
        $mailboxEmail = strtolower(trim($email ?: (string) $user->email));

        if (! filter_var($mailboxEmail, FILTER_VALIDATE_EMAIL)) {
            throw new RuntimeException('A valid email address is required.');
        }

        if ($password === '') {
            throw new RuntimeException('Mailbox password is required.');
        }

        $this->ensureImapAvailable();

        $config = $this->serverConfig($user, $mailboxEmail);
        $mailbox = $this->mailboxString($config);

        $previous = imap_errors();
        if (is_array($previous)) {
            imap_errors();
        }

        $connection = $this->openMailbox($mailbox, $mailboxEmail, $password);
        imap_close($connection);

        $existingCount = UserMailCredential::query()->where('user_id', $user->id)->count();
        $existing = UserMailCredential::query()
            ->where('user_id', $user->id)
            ->where('email', $mailboxEmail)
            ->first();

        $makePrimary = $existingCount === 0 || ($existing && $existing->is_primary);

        $credential = UserMailCredential::query()->updateOrCreate(
            [
                'user_id' => $user->id,
                'email' => $mailboxEmail,
            ],
            [
                'label' => $label !== null && $label !== '' ? $label : ($existing?->label),
                'is_primary' => $makePrimary || ($existing?->is_primary ?? false) || $existingCount === 0,
                'password' => Crypt::encryptString($password),
                'verified_at' => now(),
            ],
        );

        if ($credential->is_primary) {
            $this->ensureSinglePrimary($user, $credential->id);
        }

        if ($credential->is_primary) {
            app(MailInboxPushService::class)->resetWatchState($user);
        }

        return $credential->fresh();
    }

    public function disconnect(User $user, ?int $accountId = null): void
    {
        if ($accountId === null) {
            UserMailCredential::query()
                ->where('user_id', $user->id)
                ->delete();

            app(MailInboxPushService::class)->resetWatchState($user);

            return;
        }

        $credential = $this->resolveAccount($user, $accountId);
        $wasPrimary = $credential->is_primary;
        $credential->delete();

        if ($wasPrimary) {
            $next = UserMailCredential::query()
                ->where('user_id', $user->id)
                ->orderBy('id')
                ->first();

            if ($next) {
                $next->is_primary = true;
                $next->save();
            }

            app(MailInboxPushService::class)->resetWatchState($user);
        }
    }

    public function setPrimaryAccount(User $user, int $accountId): UserMailCredential
    {
        $credential = $this->resolveAccount($user, $accountId);
        $this->ensureSinglePrimary($user, $credential->id);
        app(MailInboxPushService::class)->resetWatchState($user);

        return $credential->fresh();
    }

    protected function ensureSinglePrimary(User $user, int $primaryId): void
    {
        UserMailCredential::query()
            ->where('user_id', $user->id)
            ->where('id', '!=', $primaryId)
            ->update(['is_primary' => false]);

        UserMailCredential::query()
            ->where('user_id', $user->id)
            ->where('id', $primaryId)
            ->update(['is_primary' => true]);
    }

    /**
     * Lightweight unread badge lookup — opens IMAP and reads SA_UNSEEN only.
     *
     * @return array{unread_count: int, folder: string, account_id: int, cached: bool}
     */
    public function unreadCount(
        User $user,
        ?int $accountId = null,
        string $folder = self::FOLDER_INBOX,
        bool $fresh = false,
    ): array {
        $credential = $this->resolveAccount($user, $accountId);
        $folder = $this->normalizeLogicalFolder($folder);
        $cacheKey = "mail:unread:{$user->id}:{$credential->id}:{$folder}";

        if (! $fresh) {
            $cached = Cache::get($cacheKey);
            if (is_array($cached) && array_key_exists('unread_count', $cached)) {
                return [
                    'unread_count' => (int) $cached['unread_count'],
                    'folder' => $folder,
                    'account_id' => $credential->id,
                    'cached' => true,
                ];
            }
        }

        $connection = $this->connect($user, $credential->id, $folder);

        try {
            $imapFolder = $this->folderMapCache[$credential->id][$folder]
                ?? $this->defaultImapFolder($folder);
            $mailbox = $this->mailboxString($this->serverConfig($user, $credential->email), $imapFolder);
            $status = imap_status($connection, $mailbox, SA_UNSEEN);
            $unreadCount = (int) ($status->unseen ?? 0);
        } finally {
            imap_close($connection);
        }

        Cache::put($cacheKey, ['unread_count' => $unreadCount], now()->addSeconds(45));

        return [
            'unread_count' => $unreadCount,
            'folder' => $folder,
            'account_id' => $credential->id,
            'cached' => false,
        ];
    }

    public function forgetUnreadCountCache(User $user, ?int $accountId = null, ?string $folder = null): void
    {
        try {
            $credential = $this->resolveAccount($user, $accountId);
        } catch (RuntimeException) {
            return;
        }

        $folders = $folder !== null
            ? [$this->normalizeLogicalFolder($folder)]
            : self::logicalFolders();

        foreach ($folders as $logicalFolder) {
            Cache::forget("mail:unread:{$user->id}:{$credential->id}:{$logicalFolder}");
        }
    }

    /**
     * @return array{messages: array<int, array<string, mixed>>, unread_count: int, folder: string, account_id: int}
     */
    public function listInbox(
        User $user,
        int $limit = 40,
        ?string $query = null,
        bool $unreadOnly = false,
        bool $includeAttachments = true,
        ?int $accountId = null,
        string $folder = self::FOLDER_INBOX,
    ): array {
        $credential = $this->resolveAccount($user, $accountId);
        $folder = $this->normalizeLogicalFolder($folder);
        $connection = $this->connect($user, $credential->id, $folder);

        try {
            $uids = $this->searchMessageUids($connection, $query, $unreadOnly);
            $imapFolder = $this->folderMapCache[$credential->id][$folder]
                ?? $this->defaultImapFolder($folder);
            $mailbox = $this->mailboxString($this->serverConfig($user, $credential->email), $imapFolder);

            if ($uids === []) {
                $status = imap_status($connection, $mailbox, SA_UNSEEN);

                return [
                    'messages' => [],
                    'unread_count' => (int) ($status->unseen ?? 0),
                    'folder' => $folder,
                    'account_id' => $credential->id,
                ];
            }

            rsort($uids);
            $uids = array_slice($uids, 0, min($limit, 100));

            $status = imap_status($connection, $mailbox, SA_UNSEEN);
            $unreadCount = (int) ($status->unseen ?? 0);

            $unreadUids = imap_search($connection, 'UNSEEN', SE_UID);
            $unreadSet = is_array($unreadUids) ? array_flip($unreadUids) : [];

            $overviews = $uids !== [] ? (imap_fetch_overview($connection, implode(',', $uids), FT_UID) ?: []) : [];
            $overviewByUid = [];

            foreach ($overviews as $overview) {
                $overviewByUid[(int) $overview->uid] = $overview;
            }

            $messages = [];

            foreach ($uids as $uid) {
                $overview = $overviewByUid[$uid] ?? null;

                if (! $overview) {
                    continue;
                }

                $seen = ! isset($unreadSet[$uid]);

                $messages[] = [
                    'uid' => $uid,
                    'subject' => $this->decodeHeader($overview->subject ?? '(No subject)'),
                    'from' => $this->decodeHeader($overview->from ?? ''),
                    'to' => $this->decodeHeader($overview->to ?? ''),
                    'date' => $overview->date ?? null,
                    'seen' => $seen,
                    'has_attachments' => $includeAttachments
                        ? $this->messageHasAttachments($connection, $uid)
                        : false,
                ];
            }

            return [
                'messages' => $messages,
                'unread_count' => $unreadCount,
                'folder' => $folder,
                'account_id' => $credential->id,
            ];
        } finally {
            imap_close($connection);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function getMessage(User $user, int $uid, ?int $accountId = null, string $folder = self::FOLDER_INBOX): array
    {
        $credential = $this->resolveAccount($user, $accountId);
        $folder = $this->normalizeLogicalFolder($folder);
        $connection = $this->connect($user, $credential->id, $folder);

        try {
            $overviewList = imap_fetch_overview($connection, (string) $uid, FT_UID);

            if (! is_array($overviewList) || $overviewList === []) {
                throw new RuntimeException('Message not found.');
            }

            $overview = $overviewList[0];
            imap_setflag_full($connection, (string) $uid, '\\Seen', ST_UID);

            $structure = imap_fetchstructure($connection, (string) $uid, FT_UID);
            $content = $this->extractMessageContent($connection, $uid, $structure);
            $attachments = $this->collectAttachments($structure);

            return [
                'uid' => $uid,
                'folder' => $folder,
                'account_id' => $credential->id,
                'subject' => $this->decodeHeader($overview->subject ?? '(No subject)'),
                'from' => $this->decodeHeader($overview->from ?? ''),
                'to' => $this->decodeHeader($overview->to ?? ''),
                'cc' => $this->decodeHeader($overview->cc ?? ''),
                'date' => $overview->date ?? null,
                'body' => $content['text'] ?: $content['html_text'],
                'body_html' => $content['html'],
                'body_text' => $content['text'],
                'message_id' => $overview->message_id ?? null,
                'reply_to' => $this->extractEmailAddress($this->decodeHeader($overview->from ?? '')),
                'seen' => true,
                'attachments' => $attachments,
                'has_attachments' => $attachments !== [],
            ];
        } finally {
            imap_close($connection);
        }
    }

    /**
     * @return array{filename: string, mime: string, content: string}
     */
    public function getAttachment(User $user, int $uid, string $partNumber, ?int $accountId = null, string $folder = self::FOLDER_INBOX): array
    {
        $partNumber = $this->normalizeAttachmentPartNumber($partNumber);
        $credential = $this->resolveAccount($user, $accountId);
        $folder = $this->normalizeLogicalFolder($folder);
        $connection = $this->connect($user, $credential->id, $folder);

        try {
            $structure = imap_fetchstructure($connection, (string) $uid, FT_UID);
            $part = $this->findPartByNumber($structure, $partNumber);

            if (! $part || ! $this->partIsAttachment($part)) {
                throw new RuntimeException('Attachment not found.');
            }

            $raw = imap_fetchbody($connection, (string) $uid, $partNumber, FT_UID);
            $content = $this->decodePart(is_string($raw) ? $raw : '', $part, convertCharset: false);
            $filename = $this->partFilename($part) ?: 'attachment-'.$partNumber;

            return [
                'filename' => $this->decodeHeader($filename),
                'mime' => $this->partMimeType($part),
                'content' => $content,
            ];
        } finally {
            imap_close($connection);
        }
    }

    /**
     * @param  array{
     *     to: string,
     *     subject: string,
     *     body: string,
     *     cc?: string|null,
     *     bcc?: string|null,
     *     in_reply_to?: string|null,
     *     references?: string|null,
     *     attachments?: array<int, UploadedFile>
     * }  $payload
     */
    public function sendMessage(User $user, array $payload, ?int $accountId = null): void
    {
        $credential = $this->resolveAccount($user, $accountId);
        $password = $this->decryptMailboxPassword($credential);
        $config = $this->serverConfig($user, $credential->email);
        $fromName = $credential->label
            ?: ($user->full_name ?? $user->name ?? $credential->email);

        config([
            'mail.default' => 'smtp',
            'mail.mailers.smtp.host' => $config['host'],
            'mail.mailers.smtp.port' => $config['smtp_port'],
            'mail.mailers.smtp.username' => $credential->email,
            'mail.mailers.smtp.password' => $password,
            'mail.mailers.smtp.scheme' => AppSettings::smtpSchemeFromEncryption($config['smtp_encryption']),
            'mail.from.address' => $credential->email,
            'mail.from.name' => $fromName,
        ]);

        Mail::mailer('smtp')->raw(
            $payload['body'],
            function ($message) use ($credential, $fromName, $payload) {
                $message->to($this->parseAddresses($payload['to']))
                    ->subject($payload['subject'])
                    ->from($credential->email, $fromName);

                if (! empty($payload['cc'])) {
                    $message->cc($this->parseAddresses($payload['cc']));
                }

                if (! empty($payload['bcc'])) {
                    $message->bcc($this->parseAddresses($payload['bcc']));
                }

                if (! empty($payload['in_reply_to'])) {
                    $message->getHeaders()->addTextHeader('In-Reply-To', (string) $payload['in_reply_to']);
                }

                if (! empty($payload['references'])) {
                    $message->getHeaders()->addTextHeader('References', (string) $payload['references']);
                }

                foreach ($payload['attachments'] ?? [] as $attachment) {
                    if (! $attachment instanceof UploadedFile) {
                        continue;
                    }

                    $message->attach(
                        $attachment->getRealPath(),
                        [
                            'as' => $attachment->getClientOriginalName(),
                            'mime' => $attachment->getClientMimeType() ?: 'application/octet-stream',
                        ]
                    );
                }
            }
        );

        // Most IMAP hosts do not auto-file SMTP traffic into Sent — copy it ourselves.
        $this->appendSentCopy($user, $credential, $password, $config, $payload, $fromName);
        $this->rememberRecipients(
            $user,
            (string) ($payload['to'] ?? ''),
            isset($payload['cc']) ? (string) $payload['cc'] : null,
            $credential->email,
        );
    }

    /**
     * Persist To/Cc addresses for future compose suggestions.
     */
    public function rememberRecipients(
        User $user,
        string $to,
        ?string $cc = null,
        ?string $excludeEmail = null,
    ): void {
        $exclude = strtolower(trim((string) $excludeEmail));
        $now = now();

        foreach ([$to, (string) $cc] as $field) {
            foreach ($this->parseAddresses($field) as $email) {
                $normalized = strtolower($email);

                if ($normalized === '' || ($exclude !== '' && $normalized === $exclude)) {
                    continue;
                }

                $existing = UserMailRecipientSuggestion::query()
                    ->where('user_id', $user->id)
                    ->where('email', $normalized)
                    ->first();

                if ($existing) {
                    $existing->forceFill([
                        'use_count' => (int) $existing->use_count + 1,
                        'last_used_at' => $now,
                    ])->save();

                    continue;
                }

                UserMailRecipientSuggestion::query()->create([
                    'user_id' => $user->id,
                    'email' => $normalized,
                    'display_name' => null,
                    'use_count' => 1,
                    'last_used_at' => $now,
                ]);
            }
        }
    }

    /**
     * @return array<int, array{email: string, display_name: string|null, source: string, use_count: int}>
     */
    public function suggestRecipients(User $user, string $query, int $limit = 8): array
    {
        $query = trim($query);
        $limit = max(1, min(20, $limit));

        if ($query === '') {
            return [];
        }

        $like = '%'.$query.'%';
        $seen = [];
        $suggestions = [];

        $history = UserMailRecipientSuggestion::query()
            ->where('user_id', $user->id)
            ->where(function ($builder) use ($like) {
                $builder->where('email', 'like', $like)
                    ->orWhere('display_name', 'like', $like);
            })
            ->orderByDesc('last_used_at')
            ->orderByDesc('use_count')
            ->limit($limit)
            ->get();

        foreach ($history as $row) {
            $email = strtolower((string) $row->email);
            if ($email === '' || isset($seen[$email])) {
                continue;
            }
            $seen[$email] = true;
            $suggestions[] = $row->toSuggestionArray();
        }

        if (count($suggestions) >= $limit) {
            return array_slice($suggestions, 0, $limit);
        }

        $directory = User::query()
            ->where('is_approved', true)
            ->whereNotNull('email')
            ->where('email', '!=', '')
            ->where('id', '!=', $user->id)
            ->matchingSearch($query)
            ->orderBy('name')
            ->orderBy('full_name')
            ->limit($limit)
            ->get(['id', 'full_name', 'name', 'email']);

        foreach ($directory as $colleague) {
            $email = strtolower(trim((string) $colleague->email));
            if ($email === '' || isset($seen[$email]) || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
                continue;
            }
            $seen[$email] = true;
            $suggestions[] = [
                'email' => $email,
                'display_name' => $colleague->displayName(),
                'source' => 'directory',
                'use_count' => 0,
            ];

            if (count($suggestions) >= $limit) {
                break;
            }
        }

        return $suggestions;
    }

    /**
     * @param  array{to?: string, cc?: string, subject?: string, body?: string, in_reply_to?: string|null, references?: string|null}  $payload
     * @return array{uid: int|null, folder: string, account_id: int, cleared?: bool}
     */
    public function saveDraft(
        User $user,
        array $payload,
        ?int $accountId = null,
        ?int $existingUid = null,
    ): array {
        $credential = $this->resolveAccount($user, $accountId);
        $to = trim((string) ($payload['to'] ?? ''));
        $cc = trim((string) ($payload['cc'] ?? ''));
        $subject = trim((string) ($payload['subject'] ?? ''));
        $body = trim((string) ($payload['body'] ?? ''));
        $isEmpty = $to === '' && $cc === '' && $subject === '' && $body === '';

        if ($isEmpty) {
            if ($existingUid) {
                try {
                    $this->deleteMessage($user, $existingUid, $credential->id, self::FOLDER_DRAFTS);
                } catch (Throwable $exception) {
                    report($exception);
                }
            }

            return [
                'uid' => null,
                'folder' => self::FOLDER_DRAFTS,
                'account_id' => $credential->id,
                'cleared' => true,
            ];
        }

        $this->ensureImapAvailable();

        if (! function_exists('imap_append')) {
            throw new RuntimeException('PHP IMAP extension is not installed on the server.');
        }

        $password = $this->decryptMailboxPassword($credential);
        $config = $this->serverConfig($user, $credential->email);
        $fromName = $credential->label
            ?: ($user->full_name ?? $user->name ?? $credential->email);

        $draftPayload = [
            ...$payload,
            'to' => $to,
            'cc' => $cc !== '' ? $cc : null,
            'subject' => $subject !== '' ? $subject : '(No subject)',
            'body' => $body,
            'attachments' => [],
        ];

        $raw = $this->buildSentMimeMessage($credential->email, $fromName, $draftPayload);
        $connection = $this->openMailbox(
            $this->mailboxString($config, 'INBOX'),
            $credential->email,
            $password,
        );

        try {
            $map = $this->discoverFolderMapFromConnection($connection, $config);
            $this->folderMapCache[$credential->id] = $map;
            $imapFolder = $map[self::FOLDER_DRAFTS] ?? $this->defaultImapFolder(self::FOLDER_DRAFTS);
            $mailbox = $this->mailboxString($config, $imapFolder);

            if (! @imap_reopen($connection, $mailbox)) {
                @imap_createmailbox($connection, $mailbox);
                if (! @imap_reopen($connection, $mailbox)) {
                    throw new RuntimeException(imap_last_error() ?: 'Could not open Drafts folder.');
                }
            }

            if ($existingUid) {
                @imap_delete($connection, (string) $existingUid, FT_UID);
                @imap_expunge($connection);
                if (! @imap_reopen($connection, $mailbox)) {
                    throw new RuntimeException(imap_last_error() ?: 'Could not reopen Drafts folder.');
                }
            }

            $status = @imap_status($connection, $mailbox, SA_UIDNEXT);
            $expectedUid = $status ? (int) $status->uidnext : 0;

            if (! @imap_append($connection, $mailbox, $raw, '\\Draft')) {
                @imap_createmailbox($connection, $mailbox);
                if (! @imap_reopen($connection, $mailbox)) {
                    throw new RuntimeException(imap_last_error() ?: 'Could not open Drafts folder.');
                }
                $status = @imap_status($connection, $mailbox, SA_UIDNEXT);
                $expectedUid = $status ? (int) $status->uidnext : 0;
                if (! @imap_append($connection, $mailbox, $raw, '\\Draft')) {
                    throw new RuntimeException(imap_last_error() ?: 'Could not save draft.');
                }
            }

            $uid = $expectedUid > 0 ? $expectedUid : $this->latestUidInMailbox($connection);

            $this->forgetUnreadCountCache($user, $credential->id, self::FOLDER_DRAFTS);

            return [
                'uid' => $uid > 0 ? $uid : null,
                'folder' => self::FOLDER_DRAFTS,
                'account_id' => $credential->id,
            ];
        } finally {
            imap_close($connection);
        }
    }

    public function deleteDraft(User $user, int $uid, ?int $accountId = null): void
    {
        $this->deleteMessage($user, $uid, $accountId, self::FOLDER_DRAFTS);
        $this->forgetUnreadCountCache($user, $accountId, self::FOLDER_DRAFTS);
    }

    /**
     * @param  resource|Connection  $connection
     */
    protected function latestUidInMailbox($connection): int
    {
        $uids = imap_search($connection, 'ALL', SE_UID);

        if (! is_array($uids) || $uids === []) {
            return 0;
        }

        return (int) max($uids);
    }

    /**
     * @param  array{host: string, port: int, encryption: string|null}  $config
     * @param  array<string, mixed>  $payload
     */
    protected function appendSentCopy(
        User $user,
        UserMailCredential $credential,
        string $password,
        array $config,
        array $payload,
        string $fromName,
    ): void {
        if (! function_exists('imap_append')) {
            return;
        }

        try {
            $raw = $this->buildSentMimeMessage($credential->email, $fromName, $payload);
            $connection = $this->openMailbox(
                $this->mailboxString($config, 'INBOX'),
                $credential->email,
                $password,
            );

            try {
                $map = $this->discoverFolderMapFromConnection($connection, $config);
                $this->folderMapCache[$credential->id] = $map;
                $imapFolder = $map[self::FOLDER_SENT] ?? $this->defaultImapFolder(self::FOLDER_SENT);
                $mailbox = $this->mailboxString($config, $imapFolder);

                if (! @imap_append($connection, $mailbox, $raw, '\\Seen')) {
                    @imap_createmailbox($connection, $mailbox);
                    if (! @imap_append($connection, $mailbox, $raw, '\\Seen')) {
                        throw new RuntimeException(imap_last_error() ?: 'Could not save message to Sent.');
                    }
                }
            } finally {
                imap_close($connection);
            }

            $this->forgetUnreadCountCache($user, $credential->id, self::FOLDER_SENT);
        } catch (Throwable $exception) {
            report($exception);
        }
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    protected function buildSentMimeMessage(string $fromEmail, string $fromName, array $payload): string
    {
        $email = (new Email())
            ->from(new Address($fromEmail, $fromName))
            ->subject((string) $payload['subject'])
            ->date(new \DateTimeImmutable('now'))
            ->text((string) $payload['body']);

        $to = $this->parseAddresses((string) ($payload['to'] ?? ''));
        if ($to !== []) {
            $email->to(...array_map(static fn (string $address) => new Address($address), $to));
        }

        $cc = $this->parseAddresses((string) ($payload['cc'] ?? ''));
        if ($cc !== []) {
            $email->cc(...array_map(static fn (string $address) => new Address($address), $cc));
        }

        $bcc = $this->parseAddresses((string) ($payload['bcc'] ?? ''));
        if ($bcc !== []) {
            $email->bcc(...array_map(static fn (string $address) => new Address($address), $bcc));
        }

        if (! empty($payload['in_reply_to'])) {
            $email->getHeaders()->addTextHeader('In-Reply-To', (string) $payload['in_reply_to']);
        }

        if (! empty($payload['references'])) {
            $email->getHeaders()->addTextHeader('References', (string) $payload['references']);
        }

        foreach ($payload['attachments'] ?? [] as $attachment) {
            if (! $attachment instanceof UploadedFile) {
                continue;
            }

            $path = $attachment->getRealPath();
            if ($path === false || $path === '') {
                continue;
            }

            $email->attachFromPath(
                $path,
                $attachment->getClientOriginalName() ?: 'attachment',
                $attachment->getClientMimeType() ?: 'application/octet-stream',
            );
        }

        return $email->toString();
    }

    public function deleteMessage(User $user, int $uid, ?int $accountId = null, string $folder = self::FOLDER_INBOX): void
    {
        $credential = $this->resolveAccount($user, $accountId);
        $connection = $this->connect($user, $credential->id, $folder);

        try {
            if (! imap_delete($connection, (string) $uid, FT_UID)) {
                throw new RuntimeException('Could not delete message.');
            }

            imap_expunge($connection);
        } finally {
            imap_close($connection);
        }
    }

    public function markUnread(User $user, int $uid, ?int $accountId = null, string $folder = self::FOLDER_INBOX): void
    {
        $credential = $this->resolveAccount($user, $accountId);
        $connection = $this->connect($user, $credential->id, $folder);

        try {
            imap_clearflag_full($connection, (string) $uid, '\\Seen', ST_UID);
        } finally {
            imap_close($connection);
        }
    }

    /**
     * @return array<int, int>
     */
    protected function searchMessageUids($connection, ?string $query, bool $unreadOnly = false): array
    {
        $query = trim((string) $query);
        $hasQuery = $query !== '';

        $searchUids = $hasQuery
            ? $this->searchUidsByText($connection, $query)
            : $this->fetchAllMessageUids($connection);

        if (! $unreadOnly) {
            return $searchUids;
        }

        $unreadUids = imap_search($connection, 'UNSEEN', SE_UID) ?: [];
        $unreadSet = is_array($unreadUids) ? array_flip($unreadUids) : [];

        return array_values(array_filter(
            $searchUids,
            static fn (int $uid): bool => isset($unreadSet[$uid]),
        ));
    }

    /**
     * PHP's imap_search() only supports IMAP2 criteria and rejects OR, so run
     * separate field searches and merge the UID lists in PHP.
     *
     * @return array<int, int>
     */
    protected function searchUidsByText($connection, string $query): array
    {
        $escaped = $this->escapeImapSearchString($query);

        if ($escaped === '') {
            return [];
        }

        $merged = [];

        foreach (['TEXT', 'SUBJECT', 'FROM', 'BODY'] as $field) {
            foreach ($this->imapSearchUids($connection, $field.' "'.$escaped.'"') as $uid) {
                $merged[$uid] = $uid;
            }
        }

        if ($merged !== []) {
            return array_values($merged);
        }

        $terms = preg_split('/\s+/', $escaped, -1, PREG_SPLIT_NO_EMPTY) ?: [];

        if (count($terms) <= 1) {
            return [];
        }

        foreach ($terms as $term) {
            foreach (['TEXT', 'SUBJECT', 'FROM'] as $field) {
                foreach ($this->imapSearchUids($connection, $field.' "'.$term.'"') as $uid) {
                    $merged[$uid] = $uid;
                }
            }
        }

        return array_values($merged);
    }

    /**
     * @return array<int, int>
     */
    protected function fetchAllMessageUids($connection): array
    {
        $uids = imap_search($connection, 'ALL', SE_UID);

        return is_array($uids) ? array_map('intval', $uids) : [];
    }

    /**
     * @return array<int, int>
     */
    protected function imapSearchUids($connection, string $criteria): array
    {
        $this->clearImapErrors();

        $uids = imap_search($connection, $criteria, SE_UID, 'UTF-8');

        if ($uids === false) {
            $this->clearImapErrors();
            $uids = imap_search($connection, $criteria, SE_UID);
        }

        if (! is_array($uids)) {
            return [];
        }

        return array_map('intval', $uids);
    }

    /**
     * Saved mailbox passwords are encrypted with APP_KEY. A DB dump from another
     * environment (or a rotated key) makes decrypt fail with a cryptic MAC error.
     */
    public function credentialsAreReadable(UserMailCredential $credential): bool
    {
        try {
            $this->decryptMailboxPassword($credential);

            return true;
        } catch (RuntimeException) {
            return false;
        }
    }

    protected function decryptMailboxPassword(UserMailCredential $credential): string
    {
        try {
            return Crypt::decryptString($credential->password);
        } catch (DecryptException) {
            throw new RuntimeException(
                'Saved mailbox password could not be read (encryption key mismatch). Reconnect this mailbox.'
            );
        }
    }

    protected function escapeImapSearchString(string $query): string
    {
        return str_replace(['\\', '"'], ['\\\\', '\\"'], trim($query));
    }

    protected function extractEmailAddress(string $value): string
    {
        if (preg_match('/<([^>]+)>/', $value, $matches)) {
            return trim($matches[1]);
        }

        $value = trim($value);

        return filter_var($value, FILTER_VALIDATE_EMAIL) ? $value : $value;
    }

    /**
     * @return resource|Connection
     */
    protected function openMailbox(string $mailbox, string $email, string $password)
    {
        $lastError = null;

        foreach ($this->imapUsernames($email) as $username) {
            imap_errors();

            $connection = @imap_open($mailbox, $username, $password, 0, 1, [
                'DISABLE_AUTHENTICATOR' => 'GSSAPI',
            ]);

            if ($connection !== false) {
                return $connection;
            }

            $lastError = imap_last_error() ?: $lastError;
        }

        throw new RuntimeException($lastError ?: 'Could not connect to mail server. Check your mailbox password.');
    }

    /**
     * @return array<int, string>
     */
    protected function imapUsernames(string $email): array
    {
        $email = strtolower(trim($email));
        $localPart = strstr($email, '@', true) ?: '';

        return array_values(array_unique(array_filter([
            $email,
            $localPart !== '' ? $localPart : null,
        ])));
    }

    protected function normalizeLogicalFolder(string $folder): string
    {
        $folder = strtolower(trim($folder));

        if (! in_array($folder, self::logicalFolders(), true)) {
            return self::FOLDER_INBOX;
        }

        return $folder;
    }

    protected function defaultImapFolder(string $logicalFolder): string
    {
        return match ($this->normalizeLogicalFolder($logicalFolder)) {
            self::FOLDER_DRAFTS => 'Drafts',
            self::FOLDER_SENT => 'Sent',
            self::FOLDER_SPAM => 'Junk',
            self::FOLDER_ARCHIVE => 'Archive',
            default => 'INBOX',
        };
    }

    /**
     * Soft cache for discovered IMAP folder names per credential id.
     *
     * @var array<int, array<string, string>>
     */
    protected array $folderMapCache = [];

    /**
     * @param  array{host: string, port: int, encryption: string|null}  $config
     * @return array<string, string>
     */
    protected function discoverFolderMapFromConnection($connection, array $config): array
    {
        $refMailbox = $this->mailboxString($config, '');
        $mailboxes = @imap_list($connection, $refMailbox, '*') ?: [];

        $names = [];
        foreach ($mailboxes as $mailboxPath) {
            $folder = $this->folderNameFromMailboxPath($mailboxPath, $refMailbox);
            if ($folder !== '') {
                $names[] = $folder;
            }
        }

        return [
            self::FOLDER_INBOX => 'INBOX',
            self::FOLDER_DRAFTS => $this->matchFolder($names, ['drafts', 'draft']) ?? 'Drafts',
            self::FOLDER_SENT => $this->matchFolder($names, ['sent items', 'sent mail', 'sent messages', 'sent']) ?? 'Sent',
            self::FOLDER_SPAM => $this->matchFolder($names, ['junk e-mail', 'junk email', 'junk', 'spam', 'bulk mail']) ?? 'Junk',
            self::FOLDER_ARCHIVE => $this->matchFolder($names, ['archive', 'archived']) ?? 'Archive',
        ];
    }

    /**
     * @param  array<int, string>  $names
     * @param  array<int, string>  $keywords
     */
    protected function matchFolder(array $names, array $keywords): ?string
    {
        $normalized = [];
        foreach ($names as $name) {
            $normalized[strtolower($name)] = $name;
            $leaf = strtolower($this->folderLeaf($name));
            $normalized[$leaf] = $normalized[$leaf] ?? $name;
        }

        foreach ($keywords as $keyword) {
            $keyword = strtolower($keyword);
            if (isset($normalized[$keyword])) {
                return $normalized[$keyword];
            }
        }

        foreach ($names as $name) {
            $haystack = strtolower($name);
            foreach ($keywords as $keyword) {
                if (str_contains($haystack, strtolower($keyword))) {
                    return $name;
                }
            }
        }

        return null;
    }

    protected function folderLeaf(string $folder): string
    {
        $folder = str_replace(['/', '\\'], '.', $folder);
        $parts = explode('.', $folder);

        return (string) end($parts);
    }

    protected function folderNameFromMailboxPath(string $mailboxPath, string $refMailbox): string
    {
        if (str_starts_with($mailboxPath, $refMailbox)) {
            return substr($mailboxPath, strlen($refMailbox));
        }

        if (preg_match('/\}(.+)$/', $mailboxPath, $matches)) {
            return $matches[1];
        }

        return $mailboxPath;
    }

    protected function clearImapErrors(): void
    {
        $errors = imap_errors();
        if (is_array($errors)) {
            imap_errors();
        }

        imap_alerts();
    }

    /**
     * @param  array{host: string, port: int, encryption: string|null}  $config
     */
    protected function mailboxString(array $config, string $folder = 'INBOX'): string
    {
        $flags = '/imap';

        if ($config['encryption'] === 'ssl') {
            $flags .= '/ssl';
        } elseif ($config['encryption'] === 'tls') {
            $flags .= '/tls';
        }

        $flags .= '/novalidate-cert';

        return '{'.$config['host'].':'.$config['port'].$flags.'}'.$folder;
    }

    protected function decodeHeader(?string $value): string
    {
        if ($value === null || $value === '') {
            return '';
        }

        $decoded = function_exists('imap_utf8') ? imap_utf8($value) : $value;

        return $this->ensureUtf8(trim($decoded !== '' ? $decoded : $value));
    }

    /**
     * @param  resource|Connection  $connection
     */
    protected function messageHasAttachments($connection, int $uid): bool
    {
        $structure = imap_fetchstructure($connection, (string) $uid, FT_UID);

        return $this->structureHasAttachments($structure);
    }

    protected function structureHasAttachments($structure): bool
    {
        if (! $structure) {
            return false;
        }

        if (isset($structure->parts) && is_array($structure->parts)) {
            foreach ($structure->parts as $part) {
                if ($this->partIsAttachment($part)) {
                    return true;
                }

                if (isset($part->parts) && $this->structureHasAttachments($part)) {
                    return true;
                }
            }
        }

        return $this->partIsAttachment($structure);
    }

    protected function partIsAttachment($part): bool
    {
        if (! $part) {
            return false;
        }

        // Only real file attachments; inline CID images are embedded in the body.
        return strtolower((string) ($part->disposition ?? '')) === 'attachment';
    }

    /**
     * @return array<int, array{part: string, filename: string, mime: string, size: int|null}>
     */
    protected function collectAttachments($structure, string $prefix = ''): array
    {
        if (! $structure) {
            return [];
        }

        $attachments = [];

        if (isset($structure->parts) && is_array($structure->parts)) {
            foreach ($structure->parts as $index => $part) {
                $partNumber = $prefix === '' ? (string) ($index + 1) : $prefix.'.'.($index + 1);

                if (isset($part->parts) && is_array($part->parts)) {
                    $attachments = array_merge($attachments, $this->collectAttachments($part, $partNumber));

                    continue;
                }

                if ($this->partIsAttachment($part)) {
                    $attachments[] = $this->attachmentMeta($part, $partNumber);
                }
            }

            return $attachments;
        }

        if ($this->partIsAttachment($structure)) {
            $attachments[] = $this->attachmentMeta($structure, $prefix !== '' ? $prefix : '1');
        }

        return $attachments;
    }

    /**
     * @return array{part: string, filename: string, mime: string, size: int|null}
     */
    protected function attachmentMeta($part, string $partNumber): array
    {
        $filename = $this->partFilename($part) ?: 'attachment-'.$partNumber;

        return [
            'part' => $partNumber,
            'filename' => $this->decodeHeader($filename),
            'mime' => $this->partMimeType($part),
            'size' => isset($part->bytes) ? (int) $part->bytes : null,
        ];
    }

    protected function partFilename($part): ?string
    {
        foreach (['dparameters', 'parameters'] as $key) {
            if (! isset($part->{$key}) || ! is_array($part->{$key})) {
                continue;
            }

            foreach ($part->{$key} as $param) {
                $attribute = strtolower((string) ($param->attribute ?? ''));

                if (in_array($attribute, ['filename', 'name'], true)) {
                    $value = trim((string) ($param->value ?? ''));

                    if ($value !== '') {
                        return $value;
                    }
                }
            }
        }

        return null;
    }

    protected function normalizeAttachmentPartNumber(string $partNumber): string
    {
        $partNumber = trim($partNumber);

        if ($partNumber === '' || ! preg_match('/^\d+(?:\.\d+)*$/', $partNumber)) {
            throw new RuntimeException('Invalid attachment part.');
        }

        return $partNumber;
    }

    /**
     * @return array{html: string|null, text: string|null, html_text: string}
     */
    protected function extractMessageContent($connection, int $uid, $structure): array
    {
        if (! $structure) {
            $raw = imap_body($connection, (string) $uid, FT_UID);
            $text = $this->normalizeBody(is_string($raw) ? $this->ensureUtf8($raw) : '');

            return [
                'html' => null,
                'text' => $text,
                'html_text' => '',
            ];
        }

        $walked = $this->walkStructureParts($connection, $uid, $structure);
        $html = $walked['html'];
        $text = $walked['text'];

        if ($html !== null && $html !== '') {
            $html = $this->embedInlineImages($connection, $uid, $html, $walked['inline_parts']);
            $html = $this->sanitizeHtml($html);
        }

        $htmlText = $html ? $this->normalizeBody(strip_tags($html)) : '';

        if ($text === null || $text === '') {
            $text = $htmlText;
        } else {
            $text = $this->normalizeBody($text);
        }

        return [
            'html' => $html ? $this->ensureUtf8($html) : null,
            'text' => $this->ensureUtf8($text ?? ''),
            'html_text' => $this->ensureUtf8($htmlText),
        ];
    }

    /**
     * @return array{html: ?string, text: ?string, inline_parts: array<string, string>}
     */
    protected function walkStructureParts($connection, int $uid, $structure, string $prefix = ''): array
    {
        $html = null;
        $text = null;
        $inlineParts = [];

        if (isset($structure->parts) && is_array($structure->parts)) {
            foreach ($structure->parts as $index => $part) {
                $partNumber = $prefix === '' ? (string) ($index + 1) : $prefix.'.'.($index + 1);

                if (isset($part->parts) && is_array($part->parts)) {
                    $nested = $this->walkStructureParts($connection, $uid, $part, $partNumber);
                    $html ??= $nested['html'];
                    $text ??= $nested['text'];
                    $inlineParts = array_merge($inlineParts, $nested['inline_parts']);

                    continue;
                }

                $type = (int) ($part->type ?? TYPETEXT);
                $subtype = strtolower((string) ($part->subtype ?? ''));

                if ($type === TYPETEXT && $subtype === 'plain' && $text === null) {
                    $text = $this->fetchPartBody($connection, $uid, $partNumber, $part);
                }

                if ($type === TYPETEXT && $subtype === 'html' && $html === null) {
                    $html = $this->fetchPartBody($connection, $uid, $partNumber, $part);
                }

                if ($type === TYPEIMAGE && isset($part->id)) {
                    $cid = $this->normalizeContentId((string) $part->id);
                    if ($cid !== '') {
                        $inlineParts[$cid] = $partNumber;
                    }
                }
            }

            return [
                'html' => $html,
                'text' => $text,
                'inline_parts' => $inlineParts,
            ];
        }

        $type = (int) ($structure->type ?? TYPETEXT);
        $subtype = strtolower((string) ($structure->subtype ?? ''));
        $partNumber = $prefix !== '' ? $prefix : '1';

        if ($type === TYPETEXT && $subtype === 'plain') {
            $text = $this->fetchPartBody($connection, $uid, $partNumber, $structure);
        } elseif ($type === TYPETEXT && $subtype === 'html') {
            $html = $this->fetchPartBody($connection, $uid, $partNumber, $structure);
        } else {
            $raw = imap_body($connection, (string) $uid, FT_UID);
            $text = $this->normalizeBody($this->decodePart(is_string($raw) ? $raw : '', $structure));
        }

        return [
            'html' => $html,
            'text' => $text,
            'inline_parts' => $inlineParts,
        ];
    }

    /**
     * @param  array<string, string>  $inlineParts
     */
    protected function embedInlineImages($connection, int $uid, string $html, array $inlineParts): string
    {
        foreach ($inlineParts as $cid => $partNumber) {
            $structure = imap_fetchstructure($connection, (string) $uid, FT_UID);
            $part = $this->findPartByNumber($structure, $partNumber);

            if (! $part) {
                continue;
            }

            $raw = imap_fetchbody($connection, (string) $uid, $partNumber, FT_UID);
            $decoded = $this->decodePart(is_string($raw) ? $raw : '', $part, convertCharset: false);
            $mime = $this->partMimeType($part);
            $dataUri = 'data:'.$mime.';base64,'.base64_encode($decoded);

            $patterns = [
                '/cid:'.preg_quote($cid, '/').'/i',
            ];

            if (str_contains($cid, '@')) {
                $local = strstr($cid, '@', true) ?: $cid;
                $patterns[] = '/cid:'.preg_quote($local, '/').'/i';
            }

            foreach ($patterns as $pattern) {
                $html = preg_replace($pattern, $dataUri, $html) ?? $html;
            }
        }

        return $html;
    }

    protected function findPartByNumber($structure, string $partNumber)
    {
        if (! str_contains($partNumber, '.')) {
            $index = (int) $partNumber - 1;

            return $structure->parts[$index] ?? $structure;
        }

        $segments = explode('.', $partNumber);
        $current = $structure;

        foreach ($segments as $segment) {
            $index = (int) $segment - 1;
            if (! isset($current->parts[$index])) {
                return null;
            }
            $current = $current->parts[$index];
        }

        return $current;
    }

    protected function normalizeContentId(string $contentId): string
    {
        return trim($contentId, " \t\n\r\0\x0B<>");
    }

    protected function partMimeType($part): string
    {
        $typeMap = [
            TYPETEXT => 'text',
            TYPEIMAGE => 'image',
            TYPEAPPLICATION => 'application',
            TYPEAUDIO => 'audio',
            TYPEVIDEO => 'video',
        ];

        $type = $typeMap[(int) ($part->type ?? TYPETEXT)] ?? 'application';
        $subtype = strtolower((string) ($part->subtype ?? 'octet-stream'));

        return $type.'/'.$subtype;
    }

    protected function sanitizeHtml(string $html): string
    {
        $html = preg_replace('/<script\b[^>]*>.*?<\/script>/is', '', $html) ?? $html;
        $html = preg_replace('/<style\b[^>]*>.*?<\/style>/is', '', $html) ?? $html;
        $html = preg_replace('/\s+on\w+\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+)/i', '', $html) ?? $html;
        $html = preg_replace('/javascript:/i', '', $html) ?? $html;

        return $html;
    }

    /**
     * @param  resource|Connection  $connection
     *
     * @deprecated Use extractMessageContent instead.
     */
    protected function extractBody($connection, int $uid, $structure): string
    {
        $content = $this->extractMessageContent($connection, $uid, $structure);

        return $content['text'] ?: $content['html_text'];
    }

    /**
     * @param  resource|Connection  $connection
     */
    protected function fetchPartBody($connection, int $uid, string $partNumber, $part): string
    {
        $raw = imap_fetchbody($connection, (string) $uid, $partNumber, FT_UID);

        return $this->decodePart(is_string($raw) ? $raw : '', $part);
    }

    protected function decodePart(string $raw, $part, bool $convertCharset = true): string
    {
        $encoding = (int) ($part->encoding ?? ENC7BIT);

        $decoded = match ($encoding) {
            ENCBASE64 => (($value = base64_decode($raw, true)) !== false ? $value : $raw),
            ENCQUOTEDPRINTABLE => quoted_printable_decode($raw),
            default => $raw,
        };

        if (! $convertCharset) {
            return $decoded;
        }

        $type = (int) ($part->type ?? TYPETEXT);

        // Only charset-convert textual parts; binary payloads must stay intact.
        if ($type !== TYPETEXT && $type !== TYPEMESSAGE) {
            return $decoded;
        }

        return $this->ensureUtf8($decoded, $this->partCharset($part));
    }

    protected function partCharset($part): ?string
    {
        foreach (['parameters', 'dparameters'] as $key) {
            if (! isset($part->{$key}) || ! is_array($part->{$key})) {
                continue;
            }

            foreach ($part->{$key} as $param) {
                if (strtolower((string) ($param->attribute ?? '')) !== 'charset') {
                    continue;
                }

                $charset = trim((string) ($param->value ?? ''), " \t\"'");

                if ($charset !== '') {
                    return $charset;
                }
            }
        }

        return null;
    }

    /**
     * Convert MIME text to valid UTF-8 so JSON responses never fail encoding.
     */
    protected function ensureUtf8(string $value, ?string $charset = null): string
    {
        if ($value === '') {
            return '';
        }

        $charset = $charset !== null ? strtoupper(trim($charset, " \t\"'")) : null;

        if ($charset !== null && $charset !== '') {
            $charset = match ($charset) {
                'UTF8', 'UTF-8' => 'UTF-8',
                'US-ASCII', 'ASCII' => 'ASCII',
                'KS_C_5601-1987', 'KSC_5601', 'ISO-2022-KR' => 'CP949',
                'GB2312', 'GB_2312-80' => 'GBK',
                'WINDOWS-31J', 'CSWINDOWS31J' => 'SJIS-win',
                'WINDOWS-1252', 'CP1252' => 'Windows-1252',
                'WINDOWS-1251', 'CP1251' => 'Windows-1251',
                'ISO-8859-1', 'LATIN1' => 'ISO-8859-1',
                default => $charset,
            };

            if ($charset !== 'UTF-8' && $charset !== 'ASCII') {
                $converted = false;

                if (function_exists('mb_convert_encoding')) {
                    $converted = @mb_convert_encoding($value, 'UTF-8', $charset);
                }

                if ($converted === false && function_exists('iconv')) {
                    $converted = @iconv($charset, 'UTF-8//IGNORE', $value);
                }

                if (is_string($converted)) {
                    $value = $converted;
                }
            }
        }

        if (function_exists('mb_check_encoding') && mb_check_encoding($value, 'UTF-8')) {
            return $value;
        }

        if (function_exists('mb_scrub')) {
            return mb_scrub($value, 'UTF-8');
        }

        if (function_exists('iconv')) {
            $scrubbed = @iconv('UTF-8', 'UTF-8//IGNORE', $value);

            if (is_string($scrubbed)) {
                return $scrubbed;
            }
        }

        if (function_exists('mb_convert_encoding')) {
            $scrubbed = @mb_convert_encoding($value, 'UTF-8', 'UTF-8');

            if (is_string($scrubbed)) {
                return $scrubbed;
            }
        }

        return preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', $value) ?? '';
    }

    protected function normalizeBody(string $body): string
    {
        $body = trim($this->ensureUtf8($body));

        return preg_replace("/\r\n?|\n/", "\n", $body) ?? $body;
    }

    /**
     * @return array<int, string>
     */
    protected function parseAddresses(string $value): array
    {
        return collect(preg_split('/\s*,\s*/', trim($value)) ?: [])
            ->map(function ($token) {
                $token = trim((string) $token);
                if ($token === '') {
                    return null;
                }

                if (preg_match('/<([^>]+)>/', $token, $matches)) {
                    $token = trim($matches[1]);
                }

                $token = strtolower($token);

                return filter_var($token, FILTER_VALIDATE_EMAIL) ? $token : null;
            })
            ->filter()
            ->unique()
            ->values()
            ->all();
    }
}
