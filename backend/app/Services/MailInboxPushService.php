<?php

namespace App\Services;

use App\Jobs\CheckMailInboxForUserJob;
use App\Models\User;
use App\Models\UserMailCredential;
use App\Models\UserMailWatchState;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

class MailInboxPushService
{
    private const SEEN_UID_LIMIT = 100;

    private const INBOX_SCAN_LIMIT = 25;

    /** Spread queued checks across this window (seconds) within each schedule cycle. */
    public const DISPATCH_WINDOW_SECONDS = 110;

    public function __construct(
        private MailMailboxService $mailMailboxService,
        private PushNotificationService $pushNotificationService,
    ) {}

    /**
     * Queue inbox checks for eligible users, staggered to avoid IMAP spikes.
     *
     * @return array{dispatched: int, skipped: int}
     */
    public function dispatchChecks(): array
    {
        $summary = [
            'dispatched' => 0,
            'skipped' => 0,
        ];

        if (! $this->mailMailboxService->isServerConfigured() || ! $this->pushNotificationService->isEnabled()) {
            return $summary;
        }

        $credentials = $this->eligibleCredentials();

        if ($credentials->isEmpty()) {
            return $summary;
        }

        $count = $credentials->count();

        foreach ($credentials as $index => $credential) {
            $user = $credential->user;

            if (! $user || ! $this->shouldCheckUser($user)) {
                $summary['skipped']++;

                continue;
            }

            $delaySeconds = $this->staggerDelaySeconds($index, $count);

            CheckMailInboxForUserJob::dispatch($user->id)
                ->onQueue('mail-inbox')
                ->delay(now()->addSeconds($delaySeconds));

            $summary['dispatched']++;
        }

        return $summary;
    }

    /**
     * Run inbox checks synchronously (used by tests and --sync).
     *
     * @return array{checked: int, notified: int, skipped: int, errors: int}
     */
    public function checkAll(): array
    {
        $summary = [
            'checked' => 0,
            'notified' => 0,
            'skipped' => 0,
            'errors' => 0,
        ];

        if (! $this->mailMailboxService->isServerConfigured() || ! $this->pushNotificationService->isEnabled()) {
            return $summary;
        }

        $credentials = $this->eligibleCredentials();

        foreach ($credentials as $credential) {
            $user = $credential->user;

            if (! $user || ! $this->shouldCheckUser($user)) {
                $summary['skipped']++;

                continue;
            }

            try {
                $notified = $this->checkUser($user);
                $summary['checked']++;
                $summary['notified'] += $notified;
            } catch (Throwable $exception) {
                $summary['errors']++;

                Log::warning('Mail inbox push check failed.', [
                    'user_id' => $user->id,
                    'error' => $exception->getMessage(),
                ]);
            }
        }

        return $summary;
    }

    public function shouldCheckUser(User $user): bool
    {
        if (! $this->userWantsMailInboxPush($user)) {
            return false;
        }

        return DB::table('push_subscriptions')
            ->where('user_id', (string) $user->id)
            ->exists();
    }

    public function checkUser(User $user): int
    {
        $inbox = $this->mailMailboxService->listInbox(
            $user,
            self::INBOX_SCAN_LIMIT,
            null,
            false,
            false,
        );
        $messages = is_array($inbox['messages'] ?? null) ? $inbox['messages'] : [];

        $state = UserMailWatchState::query()->firstOrCreate(
            ['user_id' => $user->id],
            ['seen_uids' => []],
        );

        $seenUids = $this->normalizeUidList($state->seen_uids ?? []);
        $seenSet = array_flip($seenUids);

        if ($state->initialized_at === null) {
            $state->seen_uids = $this->mergeSeenUids($seenUids, $messages);
            $state->initialized_at = now();
            $state->last_checked_at = now();
            $state->save();

            return 0;
        }

        $newUnread = [];

        foreach ($messages as $message) {
            $uid = (string) ($message['uid'] ?? '');

            if ($uid === '' || isset($seenSet[$uid]) || ! empty($message['seen'])) {
                continue;
            }

            $newUnread[] = $message;
        }

        usort($newUnread, fn (array $left, array $right) => strcmp(
            (string) ($left['date'] ?? ''),
            (string) ($right['date'] ?? ''),
        ));

        $notified = 0;

        foreach ($newUnread as $message) {
            $this->sendMailPush($user, $message);
            $notified++;
        }

        $state->seen_uids = $this->mergeSeenUids($seenUids, $messages);
        $state->last_checked_at = now();
        $state->save();

        return $notified;
    }

    public function resetWatchState(User $user): void
    {
        UserMailWatchState::query()->where('user_id', $user->id)->delete();
    }

    /**
     * @param  array<string, mixed>  $message
     */
    private function sendMailPush(User $user, array $message): void
    {
        $uid = (int) ($message['uid'] ?? 0);
        $path = $uid > 0 ? "/email/{$uid}" : '/email';

        $this->pushNotificationService->sendToUser($user->id, [
            'id' => $uid > 0 ? "mail-{$uid}" : 'mail-inbox',
            'title' => (string) ($message['from'] ?? 'New email') ?: 'New email',
            'message' => (string) ($message['subject'] ?? '(No subject)') ?: '(No subject)',
            'body' => (string) ($message['subject'] ?? '(No subject)') ?: '(No subject)',
            'type' => 'info',
            'category' => 'mail',
            'action_url' => $path,
            'url' => $path,
        ], $uid > 0 ? "mail-{$user->id}-{$uid}" : "mail-{$user->id}-inbox");
    }

    private function eligibleCredentials()
    {
        $userIdsWithPush = DB::table('push_subscriptions')
            ->distinct()
            ->pluck('user_id');

        if ($userIdsWithPush->isEmpty()) {
            return collect();
        }

        return UserMailCredential::query()
            ->with('user')
            ->whereIn('user_id', $userIdsWithPush)
            ->where('is_primary', true)
            ->orderBy('user_id')
            ->get();
    }

    private function staggerDelaySeconds(int $index, int $count): int
    {
        if ($count <= 1) {
            return 0;
        }

        return (int) floor(($index / ($count - 1)) * self::DISPATCH_WINDOW_SECONDS);
    }

    private function userWantsMailInboxPush(User $user): bool
    {
        $settings = $user->notification_settings ?? [];

        if (is_string($settings)) {
            $decoded = json_decode($settings, true);
            $settings = is_array($decoded) ? $decoded : [];
        }

        if (! is_array($settings)) {
            return true;
        }

        return ($settings['mail_inbox'] ?? true) !== false;
    }

    /**
     * @param  array<int, string>  $existing
     * @param  array<int, array<string, mixed>>  $messages
     * @return array<int, string>
     */
    private function mergeSeenUids(array $existing, array $messages): array
    {
        $uids = $existing;

        foreach ($messages as $message) {
            $uid = (string) ($message['uid'] ?? '');

            if ($uid !== '') {
                $uids[] = $uid;
            }
        }

        $uids = array_values(array_unique($uids));

        if (count($uids) > self::SEEN_UID_LIMIT) {
            $uids = array_slice($uids, 0, self::SEEN_UID_LIMIT);
        }

        return $uids;
    }

    /**
     * @param  mixed  $uids
     * @return array<int, string>
     */
    private function normalizeUidList(mixed $uids): array
    {
        if (! is_array($uids)) {
            return [];
        }

        return array_values(array_filter(array_map(
            static fn ($uid) => (string) $uid,
            $uids,
        ), static fn (string $uid) => $uid !== ''));
    }
}
