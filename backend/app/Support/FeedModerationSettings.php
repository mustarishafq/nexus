<?php

namespace App\Support;

use App\Models\User;

class FeedModerationSettings
{
    public const DEFAULT_REQUIRE_APPROVAL = false;

    public static function requireApproval(?object $settings = null): bool
    {
        $settings ??= AppSettings::row();

        if (! $settings) {
            return self::DEFAULT_REQUIRE_APPROVAL;
        }

        return self::toBool($settings->feed_posts_require_approval ?? self::DEFAULT_REQUIRE_APPROVAL);
    }

    /**
     * @return list<int>
     */
    public static function exemptUserIds(?object $settings = null): array
    {
        $settings ??= AppSettings::row();

        if (! $settings) {
            return [];
        }

        return self::normalizeExemptUserIds($settings->feed_post_approval_exempt_user_ids ?? null);
    }

    public static function userRequiresApproval(User $user, ?object $settings = null): bool
    {
        $settings ??= AppSettings::row();

        if (! self::requireApproval($settings)) {
            return false;
        }

        if (UserRoles::isHrOrAdmin($user)) {
            return false;
        }

        return ! in_array((int) $user->id, self::exemptUserIds($settings), true);
    }

    public static function userCanPostWithoutApproval(User $user, ?object $settings = null): bool
    {
        return ! self::userRequiresApproval($user, $settings);
    }

    /**
     * @return array{
     *   feed_posts_require_approval: bool,
     *   feed_post_approval_exempt_user_ids: list<int>
     * }
     */
    public static function payload(?object $settings = null, bool $includeUsers = false): array
    {
        $settings ??= AppSettings::row();
        $exemptIds = self::exemptUserIds($settings);

        $payload = [
            'feed_posts_require_approval' => self::requireApproval($settings),
            'feed_post_approval_exempt_user_ids' => $exemptIds,
        ];

        if ($includeUsers) {
            $payload['feed_post_approval_exempt_users'] = self::hydrateExemptUsers($exemptIds);
        }

        return $payload;
    }

    /** @return array<string, mixed> */
    public static function validationRules(): array
    {
        return [
            'feed_posts_require_approval' => ['nullable', 'boolean'],
            'feed_post_approval_exempt_user_ids' => ['nullable', 'array'],
            'feed_post_approval_exempt_user_ids.*' => ['integer', 'distinct', 'exists:users,id'],
        ];
    }

    /**
     * @param  list<int>  $exemptUserIds
     * @return array{feed_posts_require_approval: bool, feed_post_approval_exempt_user_ids: string}
     */
    public static function toDatabaseColumns(bool $requireApproval, array $exemptUserIds = []): array
    {
        return [
            'feed_posts_require_approval' => $requireApproval,
            'feed_post_approval_exempt_user_ids' => json_encode(array_values(self::normalizeExemptUserIds($exemptUserIds))),
        ];
    }

    /**
     * @return list<int>
     */
    public static function normalizeExemptUserIds(mixed $value): array
    {
        if (is_string($value)) {
            $decoded = json_decode($value, true);
            $value = is_array($decoded) ? $decoded : [];
        }

        if (! is_array($value)) {
            return [];
        }

        return collect($value)
            ->map(fn ($id) => (int) $id)
            ->filter(fn (int $id) => $id > 0)
            ->unique()
            ->values()
            ->all();
    }

    /**
     * @param  list<int>  $userIds
     * @return list<array<string, mixed>>
     */
    public static function hydrateExemptUsers(array $userIds): array
    {
        if ($userIds === []) {
            return [];
        }

        return User::query()
            ->whereIn('id', $userIds)
            ->where('is_approved', true)
            ->orderBy('full_name')
            ->orderBy('email')
            ->get(['id', 'full_name', 'email', 'profile_picture', 'role'])
            ->map(fn (User $user) => [
                'id' => $user->id,
                'full_name' => $user->full_name,
                'email' => $user->email,
                'profile_picture' => $user->profile_picture,
                'role' => $user->role,
            ])
            ->values()
            ->all();
    }

    private static function toBool(mixed $value): bool
    {
        if (is_bool($value)) {
            return $value;
        }

        if (is_numeric($value)) {
            return (int) $value === 1;
        }

        return in_array(strtolower(trim((string) $value)), ['1', 'true', 'yes', 'on'], true);
    }
}
