<?php

namespace App\Support;

class GamificationCatalog
{
    public const STREAK_EARLY_CLOCK_IN = 'early_clock_in';

    public const STREAK_FEED_POST = 'feed_post';

    public const MAX_STREAK_BONUS_DAYS = 14;

    /** Flat EXP required to advance one level. */
    public const EXP_PER_LEVEL = 100;

    /** Streak day counts that trigger a milestone celebration. */
    public const STREAK_MILESTONES = [3, 7, 14];

    /**
     * Derive level progress from claimed EXP total.
     *
     * @return array{
     *   level: int,
     *   exp_into_level: int,
     *   exp_for_level: int,
     *   progress: float
     * }
     */
    public static function levelProgress(int $expTotal): array
    {
        $exp = max(0, $expTotal);
        $perLevel = self::EXP_PER_LEVEL;
        $level = intdiv($exp, $perLevel) + 1;
        $into = $exp % $perLevel;

        return [
            'level' => $level,
            'exp_into_level' => $into,
            'exp_for_level' => $perLevel,
            'progress' => $perLevel > 0 ? round($into / $perLevel, 4) : 0.0,
        ];
    }

    /**
     * @return array<string, array{
     *   base: int,
     *   title: string,
     *   description: string,
     *   href: string|null,
     *   daily_cap: int|null,
     *   streak_key: string|null
     * }>
     */
    /**
     * Code defaults (no admin overrides applied).
     *
     * @return array<string, array{
     *   base: int,
     *   title: string,
     *   description: string,
     *   href: string|null,
     *   daily_cap: int|null,
     *   streak_key: string|null
     * }>
     */
    public static function defaultActions(): array
    {
        return [
            'clock_in' => [
                'base' => 10,
                'title' => 'Clock in',
                'description' => 'Record your attendance clock-in for the day.',
                'href' => '/attendance',
                'daily_cap' => 1,
                'streak_key' => null,
            ],
            'clock_in_early' => [
                'base' => 15,
                'title' => 'Early clock in',
                'description' => 'Clock in on time or before your shift starts.',
                'href' => '/attendance',
                'daily_cap' => 1,
                'streak_key' => self::STREAK_EARLY_CLOCK_IN,
            ],
            'clock_out' => [
                'base' => 5,
                'title' => 'Clock out',
                'description' => 'Clock out at the end of your day.',
                'href' => '/attendance',
                'daily_cap' => 1,
                'streak_key' => null,
            ],
            'feed_post' => [
                'base' => 20,
                'title' => 'Feed post',
                'description' => 'Share an update on the company feed.',
                'href' => '/feed',
                'daily_cap' => 1,
                'streak_key' => self::STREAK_FEED_POST,
            ],
            'feed_react' => [
                'base' => 2,
                'title' => 'Post reaction',
                'description' => 'React to a colleague\'s post.',
                'href' => '/feed',
                'daily_cap' => 20,
                'streak_key' => null,
            ],
            'feed_comment' => [
                'base' => 8,
                'title' => 'Feed comment',
                'description' => 'Leave a comment on the company feed.',
                'href' => '/feed',
                'daily_cap' => 10,
                'streak_key' => null,
            ],
            'feed_comment_react' => [
                'base' => 1,
                'title' => 'Comment reaction',
                'description' => 'React to a comment on the feed.',
                'href' => '/feed',
                'daily_cap' => 20,
                'streak_key' => null,
            ],
            'feed_poll_vote' => [
                'base' => 3,
                'title' => 'Poll vote',
                'description' => 'Vote on a feed poll.',
                'href' => '/feed',
                'daily_cap' => 5,
                'streak_key' => null,
            ],
            'event_check_in' => [
                'base' => 25,
                'title' => 'Event check-in',
                'description' => 'Check in to a calendar event.',
                'href' => '/scan-qr',
                'daily_cap' => null,
                'streak_key' => null,
            ],
            'celebration_wish' => [
                'base' => 10,
                'title' => 'Celebration wish',
                'description' => 'Send a birthday or anniversary reaction.',
                'href' => '/',
                'daily_cap' => 5,
                'streak_key' => null,
            ],
            'profile_media_react' => [
                'base' => 2,
                'title' => 'Profile media reaction',
                'description' => 'React to someone\'s profile or cover photo.',
                'href' => '/people',
                'daily_cap' => 20,
                'streak_key' => null,
            ],
            'profile_media_comment' => [
                'base' => 8,
                'title' => 'Profile media comment',
                'description' => 'Comment on someone\'s profile or cover photo.',
                'href' => '/people',
                'daily_cap' => 10,
                'streak_key' => null,
            ],
        ];
    }

    /**
     * Effective actions (defaults merged with admin overrides).
     *
     * @return array<string, array{
     *   base: int,
     *   title: string,
     *   description: string,
     *   href: string|null,
     *   daily_cap: int|null,
     *   streak_key: string|null
     * }>
     */
    public static function actions(): array
    {
        return GamificationSettings::applyToActions(self::defaultActions());
    }

    /**
     * @return array{base: int, title: string, description: string, href: string|null, daily_cap: int|null, streak_key: string|null}|null
     */
    public static function action(string $actionKey): ?array
    {
        return self::actions()[$actionKey] ?? null;
    }

    public static function streakBonus(int $base, int $streakCount): int
    {
        if ($streakCount <= 1) {
            return 0;
        }

        $capped = min($streakCount, self::MAX_STREAK_BONUS_DAYS);

        return (int) floor($base * 0.25 * $capped);
    }

    /**
     * @return list<array{
     *   action_key: string,
     *   title: string,
     *   description: string,
     *   href: string|null,
     *   base: int,
     *   daily_cap: int|null,
     *   streak_key: string|null
     * }>
     */
    public static function serializedActions(): array
    {
        $items = [];

        foreach (self::actions() as $actionKey => $definition) {
            $items[] = [
                'action_key' => $actionKey,
                'title' => $definition['title'],
                'description' => $definition['description'],
                'href' => $definition['href'],
                'base' => (int) $definition['base'],
                'daily_cap' => $definition['daily_cap'],
                'streak_key' => $definition['streak_key'],
            ];
        }

        return $items;
    }
}
