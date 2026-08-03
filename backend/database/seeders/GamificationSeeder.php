<?php

namespace Database\Seeders;

use App\Models\ExpReward;
use App\Models\User;
use App\Models\UserStreak;
use App\Support\GamificationCatalog;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class GamificationSeeder extends Seeder
{
    private const SEED_TAG = 'gamification_dummy';

    public function run(): void
    {
        $seedEmail = env('GAMIFICATION_SEED_USER_EMAIL', env('ATTENDANCE_SEED_USER_EMAIL', 'admin@admin.com'));

        $primary = User::query()
            ->where('email', $seedEmail)
            ->where('is_approved', true)
            ->whereNull('deleted_at')
            ->first();

        if (! $primary) {
            $this->command?->warn("User [{$seedEmail}] not found. Skipping gamification dummy data.");

            return;
        }

        $users = User::query()
            ->where('is_approved', true)
            ->whereNull('deleted_at')
            ->orderBy('id')
            ->limit(40)
            ->get();

        if ($users->isEmpty()) {
            $this->command?->warn('No approved users found. Skipping gamification dummy data.');

            return;
        }

        DB::transaction(function () use ($primary, $users) {
            $this->clearSeededData($users->pluck('id')->all());

            $claimedCount = $this->seedLeaderboard($users, $primary);
            $pendingCount = $this->seedPendingClaims($primary);
            $this->seedStreaks($primary);

            $this->command?->info(sprintf(
                'Seeded gamification dummy data: %d claimed rewards, %d pending for %s, streaks set.',
                $claimedCount,
                $pendingCount,
                $primary->email,
            ));
        });
    }

    /**
     * @param  list<int>  $userIds
     */
    private function clearSeededData(array $userIds): void
    {
        $seededRewardIds = ExpReward::query()
            ->whereIn('user_id', $userIds)
            ->where('metadata->seed', self::SEED_TAG)
            ->pluck('id');

        if ($seededRewardIds->isNotEmpty()) {
            $affectedUsers = ExpReward::query()
                ->whereIn('id', $seededRewardIds)
                ->get(['user_id', 'amount', 'status']);

            ExpReward::query()->whereIn('id', $seededRewardIds)->delete();

            foreach ($affectedUsers->groupBy('user_id') as $userId => $rewards) {
                $claimedSum = $rewards
                    ->where('status', ExpReward::STATUS_CLAIMED)
                    ->sum('amount');

                if ($claimedSum > 0) {
                    User::query()
                        ->whereKey($userId)
                        ->where('exp_total', '>=', $claimedSum)
                        ->decrement('exp_total', (int) $claimedSum);
                }
            }
        }
    }

    /**
     * @param  \Illuminate\Support\Collection<int, User>  $users
     */
    private function seedLeaderboard($users, User $primary): int
    {
        $actions = array_keys(GamificationCatalog::actions());
        $created = 0;
        $now = Carbon::now();

        // Deterministic ranking so primary lands near the top with pending still to claim.
        $rankBuckets = [
            520, 480, 445, 410, 385, 360, 340, 315, 290, 270,
            250, 235, 220, 205, 190, 175, 160, 150, 140, 130,
            120, 110, 100, 95, 90, 85, 80, 75, 70, 65,
            60, 55, 50, 45, 40, 35, 30, 25, 20, 15,
        ];

        foreach ($users->values() as $index => $user) {
            $targetExp = $rankBuckets[$index] ?? max(10, 200 - ($index * 5));

            // Give primary a strong mid-top score so claimable pending still moves them.
            if ((int) $user->id === (int) $primary->id) {
                $targetExp = 395;
            }

            $remaining = $targetExp;
            $rewardIndex = 0;

            while ($remaining > 0) {
                $actionKey = $actions[$rewardIndex % count($actions)];
                $definition = GamificationCatalog::action($actionKey);
                $amount = min($remaining, max(1, (int) ($definition['base'] ?? 10)));

                // Spread claimed_at across week / month / older for period boards.
                $daysAgo = match (true) {
                    $rewardIndex % 5 === 0 => random_int(1, 5),
                    $rewardIndex % 5 === 1 => random_int(6, 14),
                    $rewardIndex % 5 === 2 => random_int(15, 28),
                    $rewardIndex % 5 === 3 => random_int(30, 45),
                    default => random_int(1, 20),
                };

                $claimedAt = $now->copy()->subDays($daysAgo)->subMinutes(random_int(0, 400));

                ExpReward::query()->create([
                    'user_id' => $user->id,
                    'action_key' => $actionKey,
                    'amount' => $amount,
                    'title' => ($definition['title'] ?? $actionKey).' (demo)',
                    'status' => ExpReward::STATUS_CLAIMED,
                    'source_type' => 'seed',
                    'source_id' => sprintf('claimed-%d-%d', $user->id, $rewardIndex),
                    'metadata' => [
                        'seed' => self::SEED_TAG,
                    ],
                    'claimed_at' => $claimedAt,
                    'created_at' => $claimedAt->copy()->subMinutes(5),
                    'updated_at' => $claimedAt,
                ]);

                $remaining -= $amount;
                $rewardIndex++;
                $created++;
            }

            User::query()->whereKey($user->id)->update([
                'exp_total' => DB::raw('exp_total + '.(int) $targetExp),
            ]);
        }

        return $created;
    }

    private function seedPendingClaims(User $primary): int
    {
        $pending = [
            ['action_key' => 'clock_in', 'source_id' => 'pending-clock-in', 'amount' => 10],
            ['action_key' => 'clock_in_early', 'source_id' => 'pending-early', 'amount' => 30, 'metadata' => ['streak_count' => 4, 'streak_bonus' => 15]],
            ['action_key' => 'feed_post', 'source_id' => 'pending-feed', 'amount' => 30, 'metadata' => ['streak_count' => 3, 'streak_bonus' => 10]],
            ['action_key' => 'feed_comment', 'source_id' => 'pending-comment-1', 'amount' => 8],
            ['action_key' => 'feed_comment', 'source_id' => 'pending-comment-2', 'amount' => 8],
            ['action_key' => 'feed_react', 'source_id' => 'pending-react-1', 'amount' => 2],
            ['action_key' => 'feed_react', 'source_id' => 'pending-react-2', 'amount' => 2],
            ['action_key' => 'celebration_wish', 'source_id' => 'pending-wish', 'amount' => 10],
            ['action_key' => 'event_check_in', 'source_id' => 'pending-event', 'amount' => 25],
        ];

        $created = 0;

        foreach ($pending as $item) {
            $definition = GamificationCatalog::action($item['action_key']);
            $amount = (int) ($item['amount'] ?? $definition['base'] ?? 10);
            $title = $definition['title'] ?? $item['action_key'];

            if (! empty($item['metadata']['streak_count']) && (int) $item['metadata']['streak_count'] > 1) {
                $title = sprintf('%s (%d-day streak)', $title, (int) $item['metadata']['streak_count']);
            }

            ExpReward::query()->create([
                'user_id' => $primary->id,
                'action_key' => $item['action_key'],
                'amount' => $amount,
                'title' => $title,
                'status' => ExpReward::STATUS_PENDING,
                'source_type' => 'seed',
                'source_id' => $item['source_id'],
                'metadata' => array_merge(
                    ['seed' => self::SEED_TAG],
                    $item['metadata'] ?? [],
                ),
                'claimed_at' => null,
            ]);

            $created++;
        }

        return $created;
    }

    private function seedStreaks(User $primary): void
    {
        $today = Carbon::now(config('app.timezone'))->toDateString();

        UserStreak::query()->updateOrCreate(
            [
                'user_id' => $primary->id,
                'streak_key' => GamificationCatalog::STREAK_EARLY_CLOCK_IN,
            ],
            [
                'current_count' => 4,
                'longest_count' => 7,
                'last_qualified_on' => $today,
            ]
        );

        UserStreak::query()->updateOrCreate(
            [
                'user_id' => $primary->id,
                'streak_key' => GamificationCatalog::STREAK_FEED_POST,
            ],
            [
                'current_count' => 3,
                'longest_count' => 5,
                'last_qualified_on' => $today,
            ]
        );
    }
}
