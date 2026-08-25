<?php

namespace App\Support;

class GamificationBadges
{
    /** @var array<int, string> */
    public const LEVEL_BADGES = [
        5 => 'level_5',
        10 => 'level_10',
        25 => 'level_25',
        50 => 'level_50',
        100 => 'level_100',
        250 => 'level_250',
    ];

    /**
     * Claimed-reward count thresholds keyed by action_key, then min count => badge_key.
     *
     * @var array<string, array<int, string>>
     */
    public const ACTION_COUNT_BADGES = [
        'feed_react' => [50 => 'social_butterfly'],
        'feed_comment' => [25 => 'commenter_25'],
        'clock_in' => [30 => 'clock_in_30'],
        'event_check_in' => [5 => 'event_5'],
        'quiz_complete' => [5 => 'quiz_5'],
    ];

    /**
     * @return array<string, array{title: string, description: string}>
     */
    public static function definitions(): array
    {
        return [
            'first_claim' => [
                'title' => 'First claim',
                'description' => 'Claim your first EXP reward.',
            ],
            'level_5' => [
                'title' => 'Level 5',
                'description' => 'Reach level 5.',
            ],
            'level_10' => [
                'title' => 'Level 10',
                'description' => 'Reach level 10.',
            ],
            'level_25' => [
                'title' => 'Level 25',
                'description' => 'Reach level 25.',
            ],
            'level_50' => [
                'title' => 'Level 50',
                'description' => 'Reach level 50.',
            ],
            'level_100' => [
                'title' => 'Level 100',
                'description' => 'Reach level 100.',
            ],
            'level_250' => [
                'title' => 'Level 250',
                'description' => 'Reach level 250.',
            ],
            'streak_early_7' => [
                'title' => 'Early bird',
                'description' => 'Keep a 7-day early clock-in streak.',
            ],
            'streak_feed_7' => [
                'title' => 'Feed regular',
                'description' => 'Keep a 7-day feed post streak.',
            ],
            'top_3' => [
                'title' => 'Podium',
                'description' => 'Reach the top 3 on the all-time board.',
            ],
            'social_butterfly' => [
                'title' => 'Social butterfly',
                'description' => 'Claim 50 post reaction rewards.',
            ],
            'commenter_25' => [
                'title' => 'Commentator',
                'description' => 'Claim 25 feed comment rewards.',
            ],
            'clock_in_30' => [
                'title' => 'Clock regular',
                'description' => 'Claim 30 clock-in rewards.',
            ],
            'event_5' => [
                'title' => 'Event goer',
                'description' => 'Claim 5 event check-in rewards.',
            ],
            'quiz_5' => [
                'title' => 'Quiz ace',
                'description' => 'Claim 5 quiz complete rewards.',
            ],
        ];
    }

    /**
     * @return list<array{badge_key: string, title: string, description: string}>
     */
    public static function serialized(): array
    {
        $items = [];
        foreach (self::definitions() as $key => $definition) {
            $items[] = [
                'badge_key' => $key,
                'title' => $definition['title'],
                'description' => $definition['description'],
            ];
        }

        return $items;
    }

    /**
     * @return array{badge_key: string, title: string, description: string}|null
     */
    public static function serialize(string $badgeKey): ?array
    {
        $definition = self::definitions()[$badgeKey] ?? null;
        if ($definition === null) {
            return null;
        }

        return [
            'badge_key' => $badgeKey,
            'title' => $definition['title'],
            'description' => $definition['description'],
        ];
    }
}
