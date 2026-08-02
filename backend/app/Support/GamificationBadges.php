<?php

namespace App\Support;

class GamificationBadges
{
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
