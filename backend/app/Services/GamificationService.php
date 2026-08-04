<?php

namespace App\Services;

use App\Models\ExpReward;
use App\Models\User;
use App\Models\UserStreak;
use App\Support\GamificationCatalog;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class GamificationService
{
    /**
     * @param  array<string, mixed>  $meta
     */
    public function offer(
        User $user,
        string $actionKey,
        string $sourceType,
        int|string $sourceId,
        array $meta = [],
    ): ?ExpReward {
        $definition = GamificationCatalog::action($actionKey);
        if ($definition === null) {
            return null;
        }

        $sourceId = (string) $sourceId;

        $existing = ExpReward::query()
            ->where('user_id', $user->id)
            ->where('action_key', $actionKey)
            ->where('source_type', $sourceType)
            ->where('source_id', $sourceId)
            ->first();

        if ($existing) {
            return null;
        }

        $timezone = $this->resolveTimezone($user);
        $today = now()->timezone($timezone)->toDateString();

        if ($definition['daily_cap'] !== null) {
            $dayStart = Carbon::parse($today, $timezone)->startOfDay()->timezone(config('app.timezone'));
            $dayEnd = Carbon::parse($today, $timezone)->endOfDay()->timezone(config('app.timezone'));

            $offeredToday = ExpReward::query()
                ->where('user_id', $user->id)
                ->where('action_key', $actionKey)
                ->whereBetween('created_at', [$dayStart, $dayEnd])
                ->count();

            if ($offeredToday >= (int) $definition['daily_cap']) {
                return null;
            }
        }

        $amount = (int) $definition['base'];
        $streakCount = null;
        $metadata = $meta;

        if ($definition['streak_key'] !== null) {
            $streak = $this->advanceStreak($user, $definition['streak_key'], $today);
            $streakCount = $streak->current_count;
            $bonus = GamificationCatalog::streakBonus($amount, $streakCount);
            $amount += $bonus;
            $metadata['streak_key'] = $definition['streak_key'];
            $metadata['streak_count'] = $streakCount;
            $metadata['streak_bonus'] = $bonus;
        }

        $title = $definition['title'];
        if ($streakCount !== null && $streakCount > 1) {
            $title = sprintf('%s (%d-day streak)', $definition['title'], $streakCount);
        }

        try {
            return ExpReward::query()->create([
                'user_id' => $user->id,
                'action_key' => $actionKey,
                'amount' => $amount,
                'title' => $title,
                'status' => ExpReward::STATUS_PENDING,
                'source_type' => $sourceType,
                'source_id' => $sourceId,
                'metadata' => $metadata === [] ? null : $metadata,
            ]);
        } catch (\Throwable) {
            // Race on unique constraint — treat as already offered.
            return null;
        }
    }

    public function claim(User $user, ExpReward $reward): ExpReward
    {
        if ($reward->user_id !== $user->id) {
            throw new RuntimeException('Forbidden');
        }

        if ($reward->status !== ExpReward::STATUS_PENDING) {
            throw new RuntimeException('Reward is not claimable.');
        }

        return DB::transaction(function () use ($user, $reward) {
            $locked = ExpReward::query()
                ->whereKey($reward->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($locked->status !== ExpReward::STATUS_PENDING) {
                throw new RuntimeException('Reward is not claimable.');
            }

            $locked->status = ExpReward::STATUS_CLAIMED;
            $locked->claimed_at = now();
            $locked->save();

            User::query()->whereKey($user->id)->lockForUpdate()->increment('exp_total', $locked->amount);
            $user->refresh();

            return $locked->fresh();
        });
    }

    /**
     * @return array{claimed_count: int, claimed_amount: int, rewards: Collection<int, ExpReward>}
     */
    public function claimAll(User $user): array
    {
        return DB::transaction(function () use ($user) {
            $rewards = ExpReward::query()
                ->where('user_id', $user->id)
                ->where('status', ExpReward::STATUS_PENDING)
                ->lockForUpdate()
                ->orderBy('id')
                ->get();

            $claimedAmount = 0;
            $claimed = collect();

            foreach ($rewards as $reward) {
                $reward->status = ExpReward::STATUS_CLAIMED;
                $reward->claimed_at = now();
                $reward->save();
                $claimedAmount += (int) $reward->amount;
                $claimed->push($reward);
            }

            if ($claimedAmount > 0) {
                User::query()->whereKey($user->id)->lockForUpdate()->increment('exp_total', $claimedAmount);
                $user->refresh();
            }

            return [
                'claimed_count' => $claimed->count(),
                'claimed_amount' => $claimedAmount,
                'rewards' => $claimed,
            ];
        });
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    public function leaderboard(string $period = 'all', int $limit = 50): Collection
    {
        $limit = max(1, min(100, $limit));
        $period = in_array($period, ['week', 'month', 'all'], true) ? $period : 'all';

        if ($period === 'all') {
            return User::query()
                ->where('is_approved', true)
                ->whereNull('deleted_at')
                ->where('exp_total', '>', 0)
                ->orderByDesc('exp_total')
                ->orderBy('id')
                ->limit($limit)
                ->get(['id', 'name', 'full_name', 'email', 'profile_picture', 'job_title', 'department_id', 'exp_total'])
                ->map(fn (User $user, int $index) => $this->serializeLeaderboardRow($user, (int) $user->exp_total, $index + 1));
        }

        $since = $period === 'week' ? now()->subDays(7) : now()->subDays(30);

        $rows = ExpReward::query()
            ->select('user_id', DB::raw('SUM(amount) as period_exp'))
            ->where('status', ExpReward::STATUS_CLAIMED)
            ->where('claimed_at', '>=', $since)
            ->groupBy('user_id')
            ->orderByDesc('period_exp')
            ->orderBy('user_id')
            ->limit($limit)
            ->get();

        $users = User::query()
            ->whereIn('id', $rows->pluck('user_id'))
            ->where('is_approved', true)
            ->whereNull('deleted_at')
            ->get(['id', 'name', 'full_name', 'email', 'profile_picture', 'job_title', 'department_id', 'exp_total'])
            ->keyBy('id');

        return $rows
            ->values()
            ->map(function ($row, int $index) use ($users) {
                $user = $users->get($row->user_id);
                if (! $user) {
                    return null;
                }

                return $this->serializeLeaderboardRow($user, (int) $row->period_exp, $index + 1);
            })
            ->filter()
            ->values();
    }

    /**
     * @return array<string, mixed>
     */
    public function summary(User $user): array
    {
        $pending = ExpReward::query()
            ->where('user_id', $user->id)
            ->where('status', ExpReward::STATUS_PENDING)
            ->orderByDesc('id')
            ->get();

        $streaks = UserStreak::query()
            ->where('user_id', $user->id)
            ->get()
            ->map(fn (UserStreak $streak) => [
                'streak_key' => $streak->streak_key,
                'current_count' => $streak->current_count,
                'longest_count' => $streak->longest_count,
                'last_qualified_on' => $streak->last_qualified_on?->toDateString(),
            ])
            ->values()
            ->all();

        return array_merge(
            $this->expProgressPayload($user),
            [
                'pending_count' => $pending->count(),
                'pending_amount' => (int) $pending->sum('amount'),
                'streaks' => $streaks,
                'pending_rewards' => $pending->map(fn (ExpReward $reward) => $this->serializeReward($reward))->values()->all(),
                'rival' => $this->resolveRival($user),
                'week_spotlight' => $this->weekSpotlight($user),
                'achievements' => app(AchievementService::class)->forUser($user),
            ]
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function missions(User $user): array
    {
        $timezone = $this->resolveTimezone($user);
        $today = now()->timezone($timezone)->toDateString();
        $dayStart = Carbon::parse($today, $timezone)->startOfDay()->timezone(config('app.timezone'));
        $dayEnd = Carbon::parse($today, $timezone)->endOfDay()->timezone(config('app.timezone'));

        $todayCounts = ExpReward::query()
            ->select('action_key', DB::raw('COUNT(*) as offered_count'))
            ->where('user_id', $user->id)
            ->whereBetween('created_at', [$dayStart, $dayEnd])
            ->groupBy('action_key')
            ->pluck('offered_count', 'action_key');

        $streaks = UserStreak::query()
            ->where('user_id', $user->id)
            ->get()
            ->keyBy('streak_key');

        $missions = collect(GamificationCatalog::serializedActions())
            ->map(function (array $mission) use ($todayCounts, $streaks) {
                $offeredToday = (int) ($todayCounts[$mission['action_key']] ?? 0);
                $cap = $mission['daily_cap'];
                $remaining = $cap === null ? null : max(0, (int) $cap - $offeredToday);
                $streak = $mission['streak_key']
                    ? $streaks->get($mission['streak_key'])
                    : null;

                return array_merge($mission, [
                    'offered_today' => $offeredToday,
                    'remaining_today' => $remaining,
                    'completed_today' => $cap !== null && $remaining === 0,
                    'streak_count' => $streak ? (int) $streak->current_count : 0,
                ]);
            })
            ->values()
            ->all();

        $pending = ExpReward::query()
            ->where('user_id', $user->id)
            ->where('status', ExpReward::STATUS_PENDING)
            ->orderByDesc('id')
            ->get();

        $streaks = UserStreak::query()
            ->where('user_id', $user->id)
            ->get()
            ->map(fn (UserStreak $streak) => [
                'streak_key' => $streak->streak_key,
                'current_count' => $streak->current_count,
                'longest_count' => $streak->longest_count,
                'last_qualified_on' => $streak->last_qualified_on?->toDateString(),
            ])
            ->values()
            ->all();

        return array_merge(
            $this->expProgressPayload($user),
            [
                'pending_count' => $pending->count(),
                'pending_amount' => (int) $pending->sum('amount'),
                'pending_rewards' => $pending->map(fn (ExpReward $reward) => $this->serializeReward($reward))->values()->all(),
                'streaks' => $streaks,
                'missions' => $missions,
                'rival' => $this->resolveRival($user),
                'week_spotlight' => $this->weekSpotlight($user),
                'achievements' => app(AchievementService::class)->forUser($user),
            ]
        );
    }

    /**
     * Snapshot for claim responses (before vs after).
     *
     * @param  Collection<int, ExpReward>|null  $claimedRewards
     * @return array<string, mixed>
     */
    public function claimOutcome(User $user, int $previousExp, ?int $previousRank, ?Collection $claimedRewards = null): array
    {
        $user->refresh();
        $previousLevel = GamificationCatalog::levelProgress($previousExp);
        $current = GamificationCatalog::levelProgress((int) $user->exp_total);
        $rank = $this->resolveRank($user);

        $streakMilestones = collect($claimedRewards ?? [])
            ->map(function (ExpReward $reward) {
                $meta = is_array($reward->metadata) ? $reward->metadata : [];
                $count = (int) ($meta['streak_count'] ?? 0);
                $key = $meta['streak_key'] ?? null;
                if (! is_string($key) || $key === '' || ! in_array($count, GamificationCatalog::STREAK_MILESTONES, true)) {
                    return null;
                }

                return [
                    'streak_key' => $key,
                    'current_count' => $count,
                ];
            })
            ->filter()
            ->unique(fn (array $row) => $row['streak_key'].':'.$row['current_count'])
            ->values()
            ->all();

        $previousStars = (int) ($previousLevel['stars'] ?? GamificationCatalog::starsFromLevel($previousLevel['level']));
        $currentStars = (int) ($current['stars'] ?? GamificationCatalog::starsFromLevel($current['level']));

        return array_merge($current, [
            'exp_total' => (int) $user->exp_total,
            'rank' => $rank,
            'previous_level' => $previousLevel['level'],
            'previous_rank' => $previousRank,
            'previous_stars' => $previousStars,
            'leveled_up' => $current['level'] > $previousLevel['level'],
            'star_earned' => $currentStars > $previousStars,
            'rank_improved' => $previousRank !== null && $rank !== null && $rank < $previousRank,
            'streak_milestones' => $streakMilestones,
        ]);
    }

    /**
     * @return array{
     *   exp_total: int,
     *   rank: int|null,
     *   level: int,
     *   exp_into_level: int,
     *   exp_for_level: int,
     *   progress: float,
     *   stars: int
     * }
     */
    public function expProgressPayload(User $user): array
    {
        $progress = GamificationCatalog::levelProgress((int) $user->exp_total);

        return array_merge($progress, [
            'exp_total' => (int) $user->exp_total,
            'rank' => $this->resolveRank($user),
        ]);
    }

    /**
     * @return Collection<int, ExpReward>
     */
    public function listRewards(User $user, ?string $status = null): Collection
    {
        $query = ExpReward::query()
            ->where('user_id', $user->id)
            ->orderByDesc('id');

        if ($status !== null && $status !== '') {
            $query->where('status', $status);
        }

        return $query->limit(100)->get();
    }

    /**
     * @return array<string, mixed>
     */
    public function serializeReward(ExpReward $reward): array
    {
        return [
            'id' => $reward->id,
            'action_key' => $reward->action_key,
            'amount' => (int) $reward->amount,
            'title' => $reward->title,
            'status' => $reward->status,
            'source_type' => $reward->source_type,
            'source_id' => $reward->source_id,
            'metadata' => $reward->metadata,
            'claimed_at' => $reward->claimed_at?->toISOString(),
            'created_date' => $reward->created_at?->toISOString(),
            'updated_date' => $reward->updated_at?->toISOString(),
        ];
    }

    /**
     * @return array{gamification_offer: array<string, mixed>}|array{}
     */
    public function offerPayload(?ExpReward $reward): array
    {
        if (! $reward) {
            return [];
        }

        return ['gamification_offer' => $this->serializeReward($reward)];
    }

    /**
     * Offer multiple rewards and return the first payload (or combined offers list).
     *
     * @param  list<?ExpReward>  $rewards
     * @return array{gamification_offer?: array<string, mixed>, gamification_offers?: list<array<string, mixed>>}
     */
    public function offersPayload(array $rewards): array
    {
        $serialized = collect($rewards)
            ->filter()
            ->map(fn (ExpReward $reward) => $this->serializeReward($reward))
            ->values()
            ->all();

        if ($serialized === []) {
            return [];
        }

        $payload = ['gamification_offer' => $serialized[0]];
        if (count($serialized) > 1) {
            $payload['gamification_offers'] = $serialized;
        }

        return $payload;
    }

    public function resolveRank(User $user): ?int
    {
        $expTotal = (int) $user->exp_total;
        if ($expTotal <= 0) {
            return null;
        }

        $ahead = User::query()
            ->where('is_approved', true)
            ->whereNull('deleted_at')
            ->where('exp_total', '>', $expTotal)
            ->count();

        return $ahead + 1;
    }

    /**
     * Closest person above the viewer on the all-time board.
     *
     * @return array<string, mixed>|null
     */
    public function resolveRival(User $user): ?array
    {
        $expTotal = (int) $user->exp_total;
        if ($expTotal <= 0) {
            return null;
        }

        $rival = User::query()
            ->where('is_approved', true)
            ->whereNull('deleted_at')
            ->where('exp_total', '>', $expTotal)
            ->orderBy('exp_total')
            ->orderByDesc('id')
            ->first(['id', 'name', 'full_name', 'email', 'profile_picture', 'job_title', 'department_id', 'exp_total']);

        if (! $rival) {
            return null;
        }

        $rivalExp = (int) $rival->exp_total;

        return [
            'user_id' => $rival->id,
            'name' => $rival->displayName(),
            'profile_picture' => $rival->profile_picture,
            'exp_total' => $rivalExp,
            'rank' => $this->resolveRank($rival),
            'exp_ahead' => max(0, $rivalExp - $expTotal),
        ];
    }

    /**
     * @return array{
     *   period: string,
     *   podium: list<array<string, mixed>>,
     *   viewer_week_rank: int|null,
     *   viewer_week_exp: int
     * }
     */
    public function weekSpotlight(User $user): array
    {
        $entries = $this->leaderboard('week', 50);
        $podium = $entries->take(3)->values()->all();

        $viewerIndex = $entries->search(fn (array $row) => (int) $row['user_id'] === (int) $user->id);
        $viewerWeekExp = 0;
        $viewerWeekRank = null;

        if ($viewerIndex !== false) {
            $row = $entries->values()->get($viewerIndex);
            $viewerWeekExp = (int) ($row['exp'] ?? 0);
            $viewerWeekRank = (int) ($row['rank'] ?? ($viewerIndex + 1));
        } else {
            $since = now()->subDays(7);
            $viewerWeekExp = (int) ExpReward::query()
                ->where('user_id', $user->id)
                ->where('status', ExpReward::STATUS_CLAIMED)
                ->where('claimed_at', '>=', $since)
                ->sum('amount');
        }

        return [
            'period' => 'week',
            'podium' => $podium,
            'viewer_week_rank' => $viewerWeekRank,
            'viewer_week_exp' => $viewerWeekExp,
        ];
    }

    private function advanceStreak(User $user, string $streakKey, string $today): UserStreak
    {
        $streak = UserStreak::query()->firstOrNew([
            'user_id' => $user->id,
            'streak_key' => $streakKey,
        ]);

        $last = $streak->last_qualified_on?->toDateString();

        if ($last === $today) {
            if (! $streak->exists) {
                $streak->current_count = 1;
                $streak->longest_count = 1;
                $streak->last_qualified_on = $today;
                $streak->save();
            }

            return $streak;
        }

        $yesterday = Carbon::parse($today)->subDay()->toDateString();

        if ($last === $yesterday) {
            $streak->current_count = ((int) $streak->current_count) + 1;
        } else {
            $streak->current_count = 1;
        }

        $streak->longest_count = max((int) $streak->longest_count, (int) $streak->current_count);
        $streak->last_qualified_on = $today;
        $streak->save();

        return $streak;
    }

    private function resolveTimezone(User $user): string
    {
        if ($user->department_id) {
            $tz = DB::table('department_attendance_settings')
                ->where('department_id', $user->department_id)
                ->where('enabled', true)
                ->value('timezone');

            if (is_string($tz) && $tz !== '' && in_array($tz, timezone_identifiers_list(), true)) {
                return $tz;
            }
        }

        return (string) config('app.timezone');
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeLeaderboardRow(User $user, int $exp, int $rank): array
    {
        return [
            'rank' => $rank,
            'user_id' => $user->id,
            'name' => $user->displayName(),
            'full_name' => $user->full_name,
            'email' => $user->email,
            'profile_picture' => $user->profile_picture,
            'job_title' => $user->job_title,
            'department_id' => $user->department_id,
            'exp' => $exp,
            'exp_total' => (int) $user->exp_total,
        ];
    }
}
