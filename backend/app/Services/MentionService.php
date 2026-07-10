<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\User;
use App\Services\PushNotificationService;

class MentionService
{
    public const TOKEN_PATTERN = '/@\[(\d+|all)\|([^\]]+)\]/';

    public const ALL_MENTION_ID = 'all';

    /**
     * @return array<int, int>
     */
    public function extractUserIds(string $body): array
    {
        preg_match_all(self::TOKEN_PATTERN, $body, $matches);

        if (empty($matches[1])) {
            return [];
        }

        $ids = collect($matches[1]);

        if ($ids->contains(self::ALL_MENTION_ID)) {
            return User::query()
                ->where('is_approved', true)
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->unique()
                ->values()
                ->all();
        }

        return $ids
            ->filter(fn ($id) => $id !== self::ALL_MENTION_ID)
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values()
            ->all();
    }

    /**
     * @param  array<int, int>  $excludeUserIds
     */
    public function notifyMentionedUsers(
        User $author,
        string $body,
        string $contextLabel,
        string $actionUrl,
        array $excludeUserIds = [],
        array $extraData = []
    ): void {
        $mentionedIds = array_diff($this->extractUserIds($body), $excludeUserIds, [$author->id]);

        if ($mentionedIds === []) {
            return;
        }

        $users = User::query()
            ->whereIn('id', $mentionedIds)
            ->where('is_approved', true)
            ->get(['id', 'full_name', 'name']);

        $authorName = $author->displayName();
        $preview = trim(preg_replace(self::TOKEN_PATTERN, '@$2', $body) ?? $body);
        $preview = mb_strlen($preview) > 120 ? mb_substr($preview, 0, 117).'...' : $preview;

        foreach ($users as $user) {
            $notification = Notification::create([
                'user_id' => (string) $user->id,
                'type' => 'info',
                'priority' => 'medium',
                'title' => "{$authorName} mentioned you in a {$contextLabel}",
                'message' => $preview,
                'category' => 'other',
                'is_read' => false,
                'is_broadcast' => false,
                'action_url' => $actionUrl,
                'delivery_channels' => ['in_app'],
                'data' => array_merge([
                    'kind' => 'mention',
                    'author_user_id' => $author->id,
                ], $extraData),
            ]);

            app(PushNotificationService::class)->sendNotification($notification);
        }
    }
}
