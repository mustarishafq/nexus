<?php

namespace App\Services;

use App\Models\ExpReward;
use App\Models\User;
use App\Models\UserAchievement;
use App\Support\GamificationBadges;
use App\Support\GamificationCatalog;
use Illuminate\Support\Collection;

class AchievementService
{
    /**
     * @param  array<string, mixed>  $claimOutcome
     * @param  Collection<int, ExpReward>|null  $claimedRewards
     * @return list<array{badge_key: string, title: string, description: string, unlocked_at: string}>
     */
    public function evaluateAfterClaim(User $user, array $claimOutcome, ?Collection $claimedRewards = null): array
    {
        $candidates = [];

        $claimedLifetime = ExpReward::query()
            ->where('user_id', $user->id)
            ->where('status', ExpReward::STATUS_CLAIMED)
            ->count();

        if ($claimedLifetime >= 1) {
            $candidates[] = 'first_claim';
        }

        $level = (int) ($claimOutcome['level'] ?? GamificationCatalog::levelProgress((int) $user->exp_total)['level']);
        foreach (GamificationBadges::LEVEL_BADGES as $minLevel => $badgeKey) {
            if ($level >= $minLevel) {
                $candidates[] = $badgeKey;
            }
        }

        $rank = $claimOutcome['rank'] ?? null;
        if ($rank !== null && (int) $rank <= 3) {
            $candidates[] = 'top_3';
        }

        foreach ($claimedRewards ?? [] as $reward) {
            $meta = is_array($reward->metadata) ? $reward->metadata : [];
            $streakKey = $meta['streak_key'] ?? null;
            $streakCount = (int) ($meta['streak_count'] ?? 0);
            if ($streakCount >= 7 && $streakKey === GamificationCatalog::STREAK_EARLY_CLOCK_IN) {
                $candidates[] = 'streak_early_7';
            }
            if ($streakCount >= 7 && $streakKey === GamificationCatalog::STREAK_FEED_POST) {
                $candidates[] = 'streak_feed_7';
            }
        }

        $actionKeys = array_keys(GamificationBadges::ACTION_COUNT_BADGES);
        $actionCounts = ExpReward::query()
            ->where('user_id', $user->id)
            ->where('status', ExpReward::STATUS_CLAIMED)
            ->whereIn('action_key', $actionKeys)
            ->selectRaw('action_key, COUNT(*) as claimed_count')
            ->groupBy('action_key')
            ->pluck('claimed_count', 'action_key');

        foreach (GamificationBadges::ACTION_COUNT_BADGES as $actionKey => $thresholds) {
            $count = (int) ($actionCounts[$actionKey] ?? 0);
            foreach ($thresholds as $minCount => $badgeKey) {
                if ($count >= $minCount) {
                    $candidates[] = $badgeKey;
                }
            }
        }

        $candidates = array_values(array_unique($candidates));
        $existing = UserAchievement::query()
            ->where('user_id', $user->id)
            ->whereIn('badge_key', $candidates)
            ->pluck('badge_key')
            ->all();

        $new = [];
        $now = now();

        foreach ($candidates as $badgeKey) {
            if (in_array($badgeKey, $existing, true)) {
                continue;
            }
            if (! isset(GamificationBadges::definitions()[$badgeKey])) {
                continue;
            }

            $row = UserAchievement::query()->create([
                'user_id' => $user->id,
                'badge_key' => $badgeKey,
                'unlocked_at' => $now,
            ]);

            $serialized = GamificationBadges::serialize($badgeKey);
            if ($serialized) {
                $new[] = array_merge($serialized, [
                    'unlocked_at' => $row->unlocked_at?->toISOString(),
                ]);
            }
        }

        return $new;
    }

    /**
     * @return array{catalog: list<array<string, mixed>>, earned: list<array<string, mixed>>}
     */
    public function forUser(User $user): array
    {
        $earnedRows = UserAchievement::query()
            ->where('user_id', $user->id)
            ->orderByDesc('unlocked_at')
            ->get();

        $earned = $earnedRows
            ->map(function (UserAchievement $row) {
                $serialized = GamificationBadges::serialize($row->badge_key);
                if (! $serialized) {
                    return null;
                }

                return array_merge($serialized, [
                    'unlocked_at' => $row->unlocked_at?->toISOString(),
                ]);
            })
            ->filter()
            ->values()
            ->all();

        return [
            'catalog' => GamificationBadges::serialized(),
            'earned' => $earned,
        ];
    }
}
