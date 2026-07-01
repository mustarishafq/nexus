<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserMailCredential;
use App\Support\AppSettings;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Mail;
use IMAP\Connection;
use RuntimeException;

class MailMailboxService
{
    /**
     * @return array{host: string, port: int, encryption: string|null, smtp_port: int, smtp_encryption: string|null}
     */
    public function serverConfig(?User $user = null): array
    {
        $settings = AppSettings::row();
        $host = $this->resolveMailHost($settings, $user);

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

    protected function resolveMailHost(?object $settings, ?User $user = null): string
    {
        $candidates = [];

        foreach ([$settings->imap_host ?? null, $settings->smtp_host ?? null] as $configured) {
            $configured = trim((string) $configured);
            if ($configured !== '') {
                $candidates[] = $configured;
            }
        }

        if ($user?->email) {
            $domain = $this->domainFromEmail($user->email);
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

        $configured = trim((string) ($settings->imap_host ?? $settings->smtp_host ?? ''));
        if ($configured !== '') {
            throw new RuntimeException("Mail server host \"{$configured}\" could not be resolved. Check admin email settings or use mail.yourdomain.com.");
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

        return checkdnsrr($host, 'A')
            || checkdnsrr($host, 'AAAA')
            || checkdnsrr($host, 'CNAME');
    }

    public function isServerConfigured(): bool
    {
        $settings = AppSettings::row();

        return trim((string) ($settings->imap_host ?? $settings->smtp_host ?? '')) !== '';
    }

    public function isServerReachableForUser(User $user): bool
    {
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
     * @return resource|Connection
     */
    public function connect(User $user)
    {
        $credential = UserMailCredential::query()
            ->where('user_id', $user->id)
            ->first();

        if (! $credential) {
            throw new RuntimeException('Mail account not connected.');
        }

        if (! function_exists('imap_open')) {
            throw new RuntimeException('PHP IMAP extension is not installed on the server.');
        }

        $password = Crypt::decryptString($credential->password);
        $config = $this->serverConfig($user);
        $mailbox = $this->mailboxString($config);

        $previous = imap_errors();
        if (is_array($previous)) {
            imap_errors();
        }

        $connection = $this->openMailbox($mailbox, $user, $password);

        return $connection;
    }

    public function testAndStoreCredentials(User $user, string $password): void
    {
        if (! filter_var($user->email, FILTER_VALIDATE_EMAIL)) {
            throw new RuntimeException('Your Nexus account needs a valid email address.');
        }

        if ($password === '') {
            throw new RuntimeException('Mailbox password is required.');
        }

        if (! function_exists('imap_open')) {
            throw new RuntimeException('PHP IMAP extension is not installed on the server.');
        }

        $config = $this->serverConfig($user);
        $mailbox = $this->mailboxString($config);

        $previous = imap_errors();
        if (is_array($previous)) {
            imap_errors();
        }

        $connection = $this->openMailbox($mailbox, $user, $password);

        imap_close($connection);

        UserMailCredential::query()->updateOrCreate(
            ['user_id' => $user->id],
            [
                'password' => Crypt::encryptString($password),
                'verified_at' => now(),
            ],
        );

        app(MailInboxPushService::class)->resetWatchState($user);
    }

    public function disconnect(User $user): void
    {
        UserMailCredential::query()
            ->where('user_id', $user->id)
            ->delete();

        app(MailInboxPushService::class)->resetWatchState($user);
    }

    /**
     * @return array{messages: array<int, array<string, mixed>>, unread_count: int}
     */
    public function listInbox(User $user, int $limit = 40, ?string $query = null, bool $unreadOnly = false, bool $includeAttachments = true): array
    {
        $connection = $this->connect($user);

        try {
            $uids = $this->searchMessageUids($connection, $query, $unreadOnly);

            if ($uids === []) {
                $mailbox = $this->mailboxString($this->serverConfig($user));
                $status = imap_status($connection, $mailbox, SA_UNSEEN);

                return [
                    'messages' => [],
                    'unread_count' => (int) ($status->unseen ?? 0),
                ];
            }

            rsort($uids);
            $uids = array_slice($uids, 0, min($limit, 100));

            $mailbox = $this->mailboxString($this->serverConfig($user));
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
            ];
        } finally {
            imap_close($connection);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function getMessage(User $user, int $uid): array
    {
        $connection = $this->connect($user);

        try {
            $overviewList = imap_fetch_overview($connection, (string) $uid, FT_UID);

            if (! is_array($overviewList) || $overviewList === []) {
                throw new RuntimeException('Message not found.');
            }

            $overview = $overviewList[0];
            imap_setflag_full($connection, (string) $uid, '\\Seen', ST_UID);

            $structure = imap_fetchstructure($connection, (string) $uid, FT_UID);
            $content = $this->extractMessageContent($connection, $uid, $structure);

            return [
                'uid' => $uid,
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
    public function sendMessage(User $user, array $payload): void
    {
        if (! $this->hasCredentials($user)) {
            throw new RuntimeException('Mail account not connected.');
        }

        $credential = UserMailCredential::query()
            ->where('user_id', $user->id)
            ->firstOrFail();

        $password = Crypt::decryptString($credential->password);
        $config = $this->serverConfig($user);

        config([
            'mail.default' => 'smtp',
            'mail.mailers.smtp.host' => $config['host'],
            'mail.mailers.smtp.port' => $config['smtp_port'],
            'mail.mailers.smtp.username' => $user->email,
            'mail.mailers.smtp.password' => $password,
            'mail.mailers.smtp.scheme' => AppSettings::smtpSchemeFromEncryption($config['smtp_encryption']),
            'mail.from.address' => $user->email,
            'mail.from.name' => $user->full_name ?? $user->name ?? $user->email,
        ]);

        Mail::mailer('smtp')->raw(
            $payload['body'],
            function ($message) use ($user, $payload) {
                $message->to($this->parseAddresses($payload['to']))
                    ->subject($payload['subject'])
                    ->from($user->email, $user->full_name ?? $user->name ?? $user->email);

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
    }

    public function deleteMessage(User $user, int $uid): void
    {
        $connection = $this->connect($user);

        try {
            if (! imap_delete($connection, (string) $uid, FT_UID)) {
                throw new RuntimeException('Could not delete message.');
            }

            imap_expunge($connection);
        } finally {
            imap_close($connection);
        }
    }

    public function markUnread(User $user, int $uid): void
    {
        $connection = $this->connect($user);

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
    protected function openMailbox(string $mailbox, User $user, string $password)
    {
        $lastError = null;

        foreach ($this->imapUsernames($user) as $username) {
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
    protected function imapUsernames(User $user): array
    {
        $email = strtolower(trim((string) $user->email));
        $localPart = strstr($email, '@', true) ?: '';

        return array_values(array_unique(array_filter([
            $email,
            $localPart !== '' ? $localPart : null,
        ])));
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

        $decoded = imap_utf8($value);

        return trim($decoded !== '' ? $decoded : $value);
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
            foreach ($structure->parts as $index => $part) {
                if ($this->partIsAttachment($part, $index + 1)) {
                    return true;
                }

                if (isset($part->parts) && $this->structureHasAttachments($part)) {
                    return true;
                }
            }
        }

        return $this->partIsAttachment($structure, 0);
    }

    protected function partIsAttachment($part, int $partNumber): bool
    {
        if (! $part) {
            return false;
        }

        $disposition = strtolower((string) ($part->disposition ?? ''));
        $isAttachment = $disposition === 'attachment';

        if ($isAttachment) {
            return true;
        }

        if ($partNumber > 0 && $disposition === 'inline' && isset($part->id)) {
            return true;
        }

        return false;
    }

    /**
     * @return array{html: string|null, text: string|null, html_text: string}
     */
    protected function extractMessageContent($connection, int $uid, $structure): array
    {
        if (! $structure) {
            $raw = imap_body($connection, (string) $uid, FT_UID);
            $text = $this->normalizeBody($raw);

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
            'html' => $html ?: null,
            'text' => $text,
            'html_text' => $htmlText,
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
            $text = $this->normalizeBody($this->decodePart($raw, $structure));
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
            $decoded = $this->decodePart($raw, $part);
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

        return $this->decodePart($raw, $part);
    }

    protected function decodePart(string $raw, $part): string
    {
        $encoding = (int) ($part->encoding ?? ENC7BIT);

        return match ($encoding) {
            ENCBASE64 => base64_decode($raw) ?: $raw,
            ENCQUOTEDPRINTABLE => quoted_printable_decode($raw),
            default => $raw,
        };
    }

    protected function normalizeBody(string $body): string
    {
        $body = trim($body);

        return preg_replace("/\r\n?|\n/", "\n", $body) ?? $body;
    }

    /**
     * @return array<int, string>
     */
    protected function parseAddresses(string $value): array
    {
        return collect(preg_split('/\s*,\s*/', trim($value)) ?: [])
            ->map(fn ($email) => trim($email))
            ->filter()
            ->values()
            ->all();
    }
}
