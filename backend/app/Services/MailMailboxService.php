<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserMailCredential;
use App\Models\UserMailRecipientSuggestion;
use App\Support\AppSettings;
use App\Support\MailImapSession;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Mail;
use RuntimeException;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;
use Throwable;
use Webklex\PHPIMAP\Attachment;
use Webklex\PHPIMAP\Attribute;
use Webklex\PHPIMAP\Client;
use Webklex\PHPIMAP\ClientManager;
use Webklex\PHPIMAP\Exceptions\MessageNotFoundException;
use Webklex\PHPIMAP\Folder;
use Webklex\PHPIMAP\IMAP;
use Webklex\PHPIMAP\Message;

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
        return (bool) config('mail.imap.enabled');
    }

    public function isServerConfigured(): bool
    {
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
     * @return Collection<int, UserMailCredential>
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

    public function connect(User $user, ?int $accountId = null, string $folder = self::FOLDER_INBOX): MailImapSession
    {
        $credential = $this->resolveAccount($user, $accountId);
        $password = $this->decryptMailboxPassword($credential);
        $config = $this->serverConfig($user, $credential->email);
        $logicalFolder = $this->normalizeLogicalFolder($folder);

        $client = $this->openMailbox($config, $credential->email, $password);
        $map = $this->discoverFolderMapFromClient($client);
        $this->folderMapCache[$credential->id] = $map;

        try {
            $imapFolder = $map[$logicalFolder] ?? $this->defaultImapFolder($logicalFolder);

            return new MailImapSession(
                $client,
                $this->resolveImapFolder($client, $imapFolder, $logicalFolder),
                $map,
            );
        } catch (Throwable $exception) {
            try {
                $client->disconnect();
            } catch (Throwable) {
            }

            if ($exception instanceof RuntimeException) {
                throw $exception;
            }

            throw new RuntimeException(
                $exception->getMessage() ?: "Could not open folder \"{$logicalFolder}\".",
                0,
                $exception,
            );
        }
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

        $config = $this->serverConfig($user, $mailboxEmail);
        $client = $this->openMailbox($config, $mailboxEmail, $password);
        $client->disconnect();

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

        $session = $this->connect($user, $credential->id, $folder);

        try {
            $unreadCount = $this->folderUnseenCount($session->folder);
        } finally {
            $session->disconnect();
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
        $session = $this->connect($user, $credential->id, $folder);

        try {
            $uids = $this->searchMessageUids($session->folder, $query, $unreadOnly);
            $unreadCount = $this->folderUnseenCount($session->folder);

            if ($uids === []) {
                return [
                    'messages' => [],
                    'unread_count' => $unreadCount,
                    'folder' => $folder,
                    'account_id' => $credential->id,
                ];
            }

            rsort($uids);
            $uids = array_slice($uids, 0, min($limit, 100));

            $fetched = $session->folder->query()
                ->where('UID', implode(',', $uids))
                ->leaveUnread()
                ->setFetchOrder('desc')
                ->setFetchBody($includeAttachments)
                ->get();

            $byUid = [];
            foreach ($fetched as $message) {
                $byUid[(int) $message->getUid()] = $message;
            }

            $messages = [];

            foreach ($uids as $uid) {
                $message = $byUid[$uid] ?? null;

                if (! $message) {
                    continue;
                }

                $messages[] = [
                    'uid' => $uid,
                    'subject' => $this->messageSubject($message),
                    'from' => $this->formatAddresses($message->getFrom()),
                    'to' => $this->formatAddresses($message->getTo()),
                    'date' => $this->messageDate($message),
                    'seen' => $message->hasFlag('Seen'),
                    'has_attachments' => $includeAttachments
                        ? $this->fileAttachments($message) !== []
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
            $session->disconnect();
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function getMessage(User $user, int $uid, ?int $accountId = null, string $folder = self::FOLDER_INBOX): array
    {
        $credential = $this->resolveAccount($user, $accountId);
        $folder = $this->normalizeLogicalFolder($folder);
        $session = $this->connect($user, $credential->id, $folder);

        try {
            $message = $this->getImapMessage($session->folder, $uid);
            $message->setFlag('Seen');

            $content = $this->extractMessageContent($message);
            $attachments = $this->collectAttachments($message);
            $from = $this->formatAddresses($message->getFrom());

            return [
                'uid' => $uid,
                'folder' => $folder,
                'account_id' => $credential->id,
                'subject' => $this->messageSubject($message),
                'from' => $from,
                'to' => $this->formatAddresses($message->getTo()),
                'cc' => $this->formatAddresses($message->getCc()),
                'date' => $this->messageDate($message),
                'body' => $content['text'] ?: $content['html_text'],
                'body_html' => $content['html'],
                'body_text' => $content['text'],
                'message_id' => $this->attributeString($message->getMessageId()) ?: null,
                'reply_to' => $this->extractEmailAddress($from),
                'seen' => true,
                'attachments' => $attachments,
                'has_attachments' => $attachments !== [],
            ];
        } finally {
            $session->disconnect();
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
        $session = $this->connect($user, $credential->id, $folder);

        try {
            $message = $this->getImapMessage($session->folder, $uid);
            $attachment = $this->findFileAttachment($message, $partNumber);

            if (! $attachment) {
                throw new RuntimeException('Attachment not found.');
            }

            $filename = $attachment->getName() ?: $attachment->filename ?: 'attachment-'.$partNumber;

            return [
                'filename' => $this->decodeHeader($filename),
                'mime' => $attachment->getContentType() ?: 'application/octet-stream',
                'content' => $attachment->getContent(),
            ];
        } finally {
            $session->disconnect();
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
        $client = $this->openMailbox($config, $credential->email, $password);

        try {
            $map = $this->discoverFolderMapFromClient($client);
            $this->folderMapCache[$credential->id] = $map;
            $imapFolder = $map[self::FOLDER_DRAFTS] ?? $this->defaultImapFolder(self::FOLDER_DRAFTS);
            $folder = $this->resolveImapFolder($client, $imapFolder, self::FOLDER_DRAFTS, create: true);

            if ($existingUid) {
                try {
                    $this->getImapMessage($folder, $existingUid)->delete(true);
                } catch (RuntimeException) {
                }
            }

            $expectedUid = $this->folderUidNext($folder);

            try {
                $folder->appendMessage($raw, ['\\Draft']);
            } catch (Throwable) {
                $folder = $this->resolveImapFolder($client, $imapFolder, self::FOLDER_DRAFTS, create: true);
                $expectedUid = $this->folderUidNext($folder);
                $folder->appendMessage($raw, ['\\Draft']);
            }

            $uid = $expectedUid > 0 ? $expectedUid : $this->latestUidInMailbox($folder);

            $this->forgetUnreadCountCache($user, $credential->id, self::FOLDER_DRAFTS);

            return [
                'uid' => $uid > 0 ? $uid : null,
                'folder' => self::FOLDER_DRAFTS,
                'account_id' => $credential->id,
            ];
        } finally {
            $client->disconnect();
        }
    }

    public function deleteDraft(User $user, int $uid, ?int $accountId = null): void
    {
        $this->deleteMessage($user, $uid, $accountId, self::FOLDER_DRAFTS);
        $this->forgetUnreadCountCache($user, $accountId, self::FOLDER_DRAFTS);
    }

    protected function latestUidInMailbox(Folder $folder): int
    {
        $uids = $this->searchUids($folder, 'ALL');

        if ($uids === []) {
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
        try {
            $raw = $this->buildSentMimeMessage($credential->email, $fromName, $payload);
            $client = $this->openMailbox($config, $credential->email, $password);

            try {
                $map = $this->discoverFolderMapFromClient($client);
                $this->folderMapCache[$credential->id] = $map;
                $imapFolder = $map[self::FOLDER_SENT] ?? $this->defaultImapFolder(self::FOLDER_SENT);
                $folder = $this->resolveImapFolder($client, $imapFolder, self::FOLDER_SENT, create: true);

                try {
                    $folder->appendMessage($raw, ['\\Seen']);
                } catch (Throwable) {
                    $folder = $this->resolveImapFolder($client, $imapFolder, self::FOLDER_SENT, create: true);
                    $folder->appendMessage($raw, ['\\Seen']);
                }
            } finally {
                $client->disconnect();
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
        $email = (new Email)
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
        $session = $this->connect($user, $credential->id, $folder);

        try {
            if (! $this->getImapMessage($session->folder, $uid)->delete(true)) {
                throw new RuntimeException('Could not delete message.');
            }
        } finally {
            $session->disconnect();
        }
    }

    public function markUnread(User $user, int $uid, ?int $accountId = null, string $folder = self::FOLDER_INBOX): void
    {
        $credential = $this->resolveAccount($user, $accountId);
        $session = $this->connect($user, $credential->id, $folder);

        try {
            $this->getImapMessage($session->folder, $uid)->unsetFlag('Seen');
        } finally {
            $session->disconnect();
        }
    }

    /**
     * @return array<int, int>
     */
    protected function searchMessageUids(Folder $folder, ?string $query, bool $unreadOnly = false): array
    {
        $query = trim((string) $query);
        $hasQuery = $query !== '';

        $searchUids = $hasQuery
            ? $this->searchUidsByText($folder, $query)
            : $this->fetchAllMessageUids($folder);

        if (! $unreadOnly) {
            return $searchUids;
        }

        $unreadSet = array_flip($this->searchUids($folder, 'UNSEEN'));

        return array_values(array_filter(
            $searchUids,
            static fn (int $uid): bool => isset($unreadSet[$uid]),
        ));
    }

    /**
     * IMAP SEARCH rejects OR on some hosts, so run separate field searches and merge.
     *
     * @return array<int, int>
     */
    protected function searchUidsByText(Folder $folder, string $query): array
    {
        $escaped = $this->escapeImapSearchString($query);

        if ($escaped === '') {
            return [];
        }

        $merged = [];

        foreach (['TEXT', 'SUBJECT', 'FROM', 'BODY'] as $field) {
            foreach ($this->searchUids($folder, $field, $escaped) as $uid) {
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
                foreach ($this->searchUids($folder, $field, $term) as $uid) {
                    $merged[$uid] = $uid;
                }
            }
        }

        return array_values($merged);
    }

    /**
     * @return array<int, int>
     */
    protected function fetchAllMessageUids(Folder $folder): array
    {
        return $this->searchUids($folder, 'ALL');
    }

    /**
     * @return array<int, int>
     */
    protected function searchUids(Folder $folder, string $field, ?string $value = null): array
    {
        try {
            $query = $folder->query();
            if ($value === null) {
                $query->where($field);
            } else {
                $query->where($field, $value);
            }

            $uids = $query->search();
        } catch (Throwable) {
            return [];
        }

        return array_values(array_map('intval', $uids->all()));
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

    protected function openMailbox(array $config, string $email, string $password): Client
    {
        $lastError = null;

        foreach ($this->imapUsernames($email) as $username) {
            try {
                $client = $this->makeImapClient($config, $username, $password);
                $client->connect();

                return $client;
            } catch (Throwable $exception) {
                $lastError = $exception->getMessage() ?: $lastError;
            }
        }

        throw new RuntimeException($lastError ?: 'Could not connect to mail server. Check your mailbox password.');
    }

    /**
     * @param  array{host: string, port: int, encryption: string|null}  $config
     */
    protected function makeImapClient(array $config, string $username, string $password): Client
    {
        $encryption = match (strtolower((string) ($config['encryption'] ?? 'ssl'))) {
            'ssl' => 'ssl',
            'tls' => 'starttls',
            default => false,
        };

        $manager = new ClientManager([
            'options' => [
                'fetch' => IMAP::FT_PEEK,
                'sequence' => IMAP::ST_UID,
                'rfc822' => false,
                'open' => [
                    'DISABLE_AUTHENTICATOR' => 'GSSAPI',
                ],
            ],
            'security' => [
                'detect_spoofing' => false,
                'detect_spoofing_exception' => false,
            ],
        ]);

        return $manager->make([
            'host' => $config['host'],
            'port' => (int) $config['port'],
            'encryption' => $encryption,
            'validate_cert' => false,
            'username' => $username,
            'password' => $password,
            'protocol' => 'imap',
            'authentication' => null,
            'timeout' => 30,
        ]);
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
     * @return array<string, string>
     */
    protected function discoverFolderMapFromClient(Client $client): array
    {
        try {
            $mailboxes = $client->getFolders(false);
        } catch (Throwable) {
            $mailboxes = [];
        }

        $names = [];
        foreach ($mailboxes as $mailbox) {
            foreach ([$mailbox->full_name ?? '', $mailbox->path ?? '', $mailbox->name ?? ''] as $name) {
                $name = trim((string) $name);
                if ($name !== '') {
                    $names[] = $name;
                }
            }
        }

        $names = array_values(array_unique($names));

        return [
            self::FOLDER_INBOX => 'INBOX',
            self::FOLDER_DRAFTS => $this->matchFolder($names, ['drafts', 'draft']) ?? 'Drafts',
            self::FOLDER_SENT => $this->matchFolder($names, ['sent items', 'sent mail', 'sent messages', 'sent']) ?? 'Sent',
            self::FOLDER_SPAM => $this->matchFolder($names, ['junk e-mail', 'junk email', 'junk', 'spam', 'bulk mail']) ?? 'Junk',
            self::FOLDER_ARCHIVE => $this->matchFolder($names, ['archive', 'archived']) ?? 'Archive',
        ];
    }

    protected function resolveImapFolder(Client $client, string $imapFolder, string $logicalFolder, bool $create = false): Folder
    {
        $folder = $this->findImapFolder($client, $imapFolder);

        if ($folder) {
            return $folder;
        }

        if ($create) {
            try {
                $folder = $client->createFolder($imapFolder);
            } catch (Throwable) {
                $folder = $this->findImapFolder($client, $imapFolder);
            }

            if ($folder) {
                return $folder;
            }
        }

        throw new RuntimeException("Could not open folder \"{$logicalFolder}\".");
    }

    protected function findImapFolder(Client $client, string $imapFolder): ?Folder
    {
        try {
            return $client->getFolderByPath($imapFolder, false, true)
                ?? $client->getFolderByName($imapFolder, true)
                ?? $client->getFolder($imapFolder);
        } catch (Throwable) {
            return null;
        }
    }

    protected function folderUnseenCount(Folder $folder): int
    {
        try {
            $status = $folder->status();
        } catch (Throwable) {
            return 0;
        }

        return (int) ($status['unseen'] ?? $status['UNSEEN'] ?? 0);
    }

    protected function folderUidNext(Folder $folder): int
    {
        try {
            $status = $folder->status();
        } catch (Throwable) {
            return 0;
        }

        return (int) ($status['uidnext'] ?? $status['UIDNEXT'] ?? 0);
    }

    protected function getImapMessage(Folder $folder, int $uid): Message
    {
        try {
            return $folder->query()->getMessageByUid($uid);
        } catch (MessageNotFoundException) {
            throw new RuntimeException('Message not found.');
        } catch (Throwable $exception) {
            throw new RuntimeException($exception->getMessage() ?: 'Message not found.', 0, $exception);
        }
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

    protected function decodeHeader(?string $value): string
    {
        if ($value === null || $value === '') {
            return '';
        }

        $decoded = $value;
        if (function_exists('iconv_mime_decode')) {
            $decoded = @iconv_mime_decode($value, ICONV_MIME_DECODE_CONTINUE_ON_ERROR, 'UTF-8') ?: $value;
        } elseif (function_exists('mb_decode_mimeheader')) {
            $decoded = mb_decode_mimeheader($value);
        }

        return $this->ensureUtf8(trim($decoded !== '' ? $decoded : $value));
    }

    protected function messageSubject(Message $message): string
    {
        $subject = $this->attributeString($message->getSubject());

        return $subject !== '' ? $subject : '(No subject)';
    }

    protected function messageDate(Message $message): ?string
    {
        $date = $message->getDate();

        if (! $date) {
            return null;
        }

        try {
            return $date->toDate()->toRfc2822String();
        } catch (Throwable) {
            $value = $this->attributeString($date);

            return $value !== '' ? $value : null;
        }
    }

    protected function attributeString(mixed $attribute): string
    {
        if ($attribute === null) {
            return '';
        }

        if ($attribute instanceof Attribute) {
            return $this->decodeHeader(trim((string) $attribute));
        }

        return $this->decodeHeader(trim((string) $attribute));
    }

    protected function formatAddresses(mixed $attribute): string
    {
        if ($attribute === null) {
            return '';
        }

        if ($attribute instanceof Attribute) {
            $parts = [];
            foreach ($attribute->all() as $address) {
                $formatted = trim((string) $address);
                if ($formatted !== '') {
                    $parts[] = $formatted;
                }
            }

            return $this->decodeHeader(implode(', ', $parts));
        }

        return $this->decodeHeader(trim((string) $attribute));
    }

    /**
     * @return array<int, Attachment>
     */
    protected function fileAttachments(Message $message): array
    {
        $files = [];

        foreach ($message->getAttachments() as $attachment) {
            if (! $this->attachmentIsFile($attachment)) {
                continue;
            }

            $files[] = $attachment;
        }

        return $files;
    }

    protected function attachmentIsFile(Attachment $attachment): bool
    {
        return strtolower((string) $attachment->getDisposition()) === 'attachment';
    }

    protected function attachmentPartId(Attachment $attachment): string
    {
        $part = (string) $attachment->getPartNumber();

        return $part !== '' ? $part : '1';
    }

    protected function findFileAttachment(Message $message, string $partNumber): ?Attachment
    {
        foreach ($this->fileAttachments($message) as $attachment) {
            if ($this->attachmentPartId($attachment) === $partNumber) {
                return $attachment;
            }
        }

        return null;
    }

    /**
     * @return array<int, array{part: string, filename: string, mime: string, size: int|null}>
     */
    protected function collectAttachments(Message $message): array
    {
        $attachments = [];

        foreach ($this->fileAttachments($message) as $attachment) {
            $partNumber = $this->attachmentPartId($attachment);
            $filename = $attachment->getName() ?: $attachment->filename ?: 'attachment-'.$partNumber;

            $attachments[] = [
                'part' => $partNumber,
                'filename' => $this->decodeHeader($filename),
                'mime' => $attachment->getContentType() ?: 'application/octet-stream',
                'size' => $attachment->getSize() !== null ? (int) $attachment->getSize() : null,
            ];
        }

        return $attachments;
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
    protected function extractMessageContent(Message $message): array
    {
        $html = $message->hasHTMLBody() ? $message->getHTMLBody() : null;
        $text = $message->hasTextBody() ? $message->getTextBody() : null;

        if ($html !== null && $html !== '') {
            $html = $this->embedInlineImages($message, $html);
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

    protected function embedInlineImages(Message $message, string $html): string
    {
        foreach ($message->getAttachments() as $attachment) {
            if ($this->attachmentIsFile($attachment)) {
                continue;
            }

            $cid = $this->normalizeContentId((string) ($attachment->id ?: ''));
            if ($cid === '') {
                continue;
            }

            $mime = $attachment->getContentType() ?: 'application/octet-stream';
            $dataUri = 'data:'.$mime.';base64,'.base64_encode($attachment->getContent());

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

    protected function normalizeContentId(string $contentId): string
    {
        return trim($contentId, " \t\n\r\0\x0B<>");
    }

    protected function sanitizeHtml(string $html): string
    {
        $html = preg_replace('/<script\b[^>]*>.*?<\/script>/is', '', $html) ?? $html;
        $html = preg_replace('/<style\b[^>]*>.*?<\/style>/is', '', $html) ?? $html;
        $html = preg_replace('/\s+on\w+\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+)/i', '', $html) ?? $html;
        $html = preg_replace('/javascript:/i', '', $html) ?? $html;

        return $html;
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
