<?php

namespace App\Services;

use App\Models\AttendanceRecord;
use App\Models\ExpReward;
use App\Models\User;
use App\Models\UserStreak;
use App\Support\AppSettings;
use App\Support\AttendanceLateEvaluator;
use App\Support\GamificationCatalog;
use App\Support\GamificationSettings;
use Carbon\Carbon;
use InvalidArgumentException;

class EarlyClockInBackfillService
{
    public const MAX_RANGE_DAYS = 31;

    public const MAX_ITEMS = 2000;

    public function __construct(private GamificationService $gamification) {}

    /**
     * @return array{
     *     dry_run: bool,
     *     status: string,
     *     date: string,
     *     date_to: string,
     *     timezone: string,
     *     window_minutes: int,
     *     cutoff_minutes: int,
     *     user_id: ?int,
     *     user_email: ?string,
     *     offered: int,
     *     already_granted: int,
     *     skipped: int,
     *     ineligible: int,
     *     scanned: int,
     *     items: list<array<string, mixed>>
     * }
     */
    public function run(
        string $date,
        ?string $dateTo = null,
        ?string $userFilter = null,
        string $status = ExpReward::STATUS_PENDING,
        bool $dryRun = false,
        ?string $timezone = null,
    ): array {
        AppSettings::forget();

        $timezone = (string) ($timezone ?: config('app.timezone'));
        $status = strtolower(trim($status));
        if (! in_array($status, [ExpReward::STATUS_PENDING, ExpReward::STATUS_CLAIMED], true)) {
            throw new InvalidArgumentException('Invalid status. Use pending or claimed.');
        }

        try {
            $from = Carbon::parse($date, $timezone)->startOfDay();
            $to = Carbon::parse($dateTo ?: $date, $timezone)->endOfDay();
        } catch (\Throwable) {
            throw new InvalidArgumentException('Invalid date. Use Y-m-d.');
        }

        if ($to->lt($from)) {
            throw new InvalidArgumentException('date_to must be on or after date.');
        }

        if ($from->diffInDays($to) > self::MAX_RANGE_DAYS) {
            throw new InvalidArgumentException('Date range cannot exceed '.self::MAX_RANGE_DAYS.' days.');
        }

        $matchedUser = null;
        $userId = null;
        $filter = trim((string) $userFilter);
        if ($filter !== '') {
            $matchedUser = ctype_digit($filter)
                ? User::query()->find((int) $filter)
                : User::query()->where('email', $filter)->first();

            if (! $matchedUser) {
                throw new InvalidArgumentException("User not found: {$filter}");
            }

            $userId = (int) $matchedUser->id;
        }

        $cutoff = GamificationSettings::earlyClockInCutoffMinutes();
        $window = GamificationSettings::earlyClockInWindowMinutes();

        $recordsQuery = AttendanceRecord::query()
            ->with('user')
            ->where('type', 'clock_in')
            ->whereBetween('captured_at', [
                $from->copy()->timezone(config('app.timezone')),
                $to->copy()->timezone(config('app.timezone')),
            ])
            ->orderBy('captured_at');

        if ($userId !== null) {
            $recordsQuery->where('user_id', $userId);
        }

        $records = $recordsQuery->get();
        $existingBySource = collect();
        if ($records->isNotEmpty()) {
            $existingBySource = ExpReward::query()
                ->where('action_key', 'clock_in_early')
                ->where('source_type', 'attendance_record')
                ->whereIn('source_id', $records->map(fn (AttendanceRecord $record) => (string) $record->id)->all())
                ->get()
                ->keyBy(fn (ExpReward $reward) => (string) $reward->source_id);
        }

        $offered = 0;
        $alreadyGranted = 0;
        $skipped = 0;
        $ineligible = 0;
        $items = [];
        $streakState = $this->loadStreakState($records->pluck('user_id')->unique()->filter()->all());
        $offeredOn = [];
        $definition = GamificationCatalog::action('clock_in_early');
        $baseAmount = (int) ($definition['base'] ?? 15);
        $missionTitle = (string) ($definition['title'] ?? 'Early clock in');

        foreach ($records as $record) {
            /** @var User|null $user */
            $user = $record->user;
            if (! $user) {
                $skipped++;

                continue;
            }

            $capturedAt = $record->captured_at instanceof Carbon
                ? $record->captured_at->copy()
                : Carbon::parse($record->captured_at);

            $late = AttendanceLateEvaluator::evaluate($user, $capturedAt, includeSpecialRelease: false);
            $hasShift = filled($late['scheduled_start'] ?? null);
            $isLate = (bool) ($late['is_late'] ?? false);

            $withinEarlyCutoff = true;
            if ($cutoff > 0 && $hasShift) {
                $scheduledStart = Carbon::parse((string) $late['scheduled_start']);
                $deadline = $scheduledStart->copy()->subMinutes($cutoff);
                $withinEarlyCutoff = ! $capturedAt->gt($deadline);
            }

            if (! $hasShift || $isLate || ! $withinEarlyCutoff) {
                $ineligible++;

                continue;
            }

            $qualifiedOn = $capturedAt->copy()->timezone($timezone)->toDateString();
            $existing = $existingBySource->get((string) $record->id);

            if ($existing) {
                $alreadyGranted++;
                $offeredOn[$user->id][$qualifiedOn] = true;
                if (count($items) < self::MAX_ITEMS) {
                    $items[] = $this->itemFromExistingReward(
                        $user,
                        $record,
                        $existing,
                        $capturedAt,
                        $timezone,
                        $qualifiedOn,
                        $streakState[(int) $user->id] ?? null,
                        $missionTitle,
                    );
                }

                continue;
            }

            if (isset($offeredOn[$user->id][$qualifiedOn])) {
                $skipped++;

                continue;
            }

            $preview = $this->previewStreak($streakState, (int) $user->id, $qualifiedOn, $baseAmount);
            $offeredOn[$user->id][$qualifiedOn] = true;

            $item = [
                'user_id' => $user->id,
                'email' => $user->email,
                'name' => $user->full_name ?: $user->name,
                'captured_at' => $capturedAt->timezone($timezone)->toDateTimeString(),
                'qualified_on' => $qualifiedOn,
                'record_id' => $record->id,
                'amount' => $preview['amount'],
                'base' => $preview['base'],
                'streak_bonus' => $preview['streak_bonus'],
                'streak_count' => $preview['streak_count'],
                'streak_skipped' => $preview['streak_skipped'],
                'previous_streak' => $preview['previous_streak'],
                'longest_streak' => $preview['longest_streak'],
                'last_qualified_on' => $preview['last_qualified_on'],
                'action_key' => 'clock_in_early',
                'mission' => $missionTitle,
                'title' => $preview['streak_count'] > 1
                    ? sprintf('%s (%d-day streak)', $missionTitle, $preview['streak_count'])
                    : $missionTitle,
                'status' => $dryRun ? 'would_'.$status : $status,
            ];

            if ($dryRun) {
                $offered++;
                if (count($items) < self::MAX_ITEMS) {
                    $items[] = $item;
                }

                continue;
            }

            $reward = $this->gamification->offer(
                $user,
                'clock_in_early',
                'attendance_record',
                $record->id,
                ['backfill' => true],
                occurredAt: $capturedAt,
            );

            if (! $reward) {
                $skipped++;

                continue;
            }

            if ($status === ExpReward::STATUS_CLAIMED) {
                $reward = $this->gamification->claim($user, $reward);
            }

            $item['amount'] = (int) $reward->amount;
            $item['status'] = $reward->status;
            $item['streak_count'] = (int) data_get($reward->metadata, 'streak_count', $preview['streak_count']);
            $item['streak_bonus'] = (int) data_get($reward->metadata, 'streak_bonus', $preview['streak_bonus']);
            $item['streak_skipped'] = (bool) data_get($reward->metadata, 'streak_skipped', $preview['streak_skipped']);
            $item['base'] = max(0, $item['amount'] - $item['streak_bonus']);
            $item['title'] = $reward->title ?: $missionTitle;
            $item['mission'] = $missionTitle;
            $item['action_key'] = 'clock_in_early';
            $offered++;
            if (count($items) < self::MAX_ITEMS) {
                $items[] = $item;
            }
        }

        return [
            'dry_run' => $dryRun,
            'status' => $status,
            'date' => $from->toDateString(),
            'date_to' => $to->toDateString(),
            'timezone' => $timezone,
            'window_minutes' => $window,
            'cutoff_minutes' => $cutoff,
            'user_id' => $matchedUser?->id,
            'user_email' => $matchedUser?->email,
            'offered' => $offered,
            'already_granted' => $alreadyGranted,
            'skipped' => $skipped,
            'ineligible' => $ineligible,
            'scanned' => $records->count(),
            'items' => $items,
        ];
    }

    /**
     * @param  array{current: int, longest: int, last: ?string}|null  $streak
     * @return array<string, mixed>
     */
    private function itemFromExistingReward(
        User $user,
        AttendanceRecord $record,
        ExpReward $reward,
        Carbon $capturedAt,
        string $timezone,
        string $qualifiedOn,
        ?array $streak,
        string $missionTitle,
    ): array {
        $bonus = (int) data_get($reward->metadata, 'streak_bonus', 0);
        $amount = (int) $reward->amount;
        $count = (int) data_get($reward->metadata, 'streak_count', 1);

        return [
            'user_id' => $user->id,
            'email' => $user->email,
            'name' => $user->full_name ?: $user->name,
            'captured_at' => $capturedAt->timezone($timezone)->toDateTimeString(),
            'qualified_on' => $qualifiedOn,
            'record_id' => $record->id,
            'amount' => $amount,
            'base' => max(0, $amount - $bonus),
            'streak_bonus' => $bonus,
            'streak_count' => $count,
            'streak_skipped' => (bool) data_get($reward->metadata, 'streak_skipped', false),
            'previous_streak' => (int) ($streak['current'] ?? $count),
            'longest_streak' => (int) ($streak['longest'] ?? $count),
            'last_qualified_on' => $streak['last'] ?? $qualifiedOn,
            'action_key' => $reward->action_key ?: 'clock_in_early',
            'mission' => $missionTitle,
            'title' => $reward->title ?: $missionTitle,
            'status' => $reward->status === ExpReward::STATUS_CLAIMED
                ? 'already_claimed'
                : 'already_pending',
        ];
    }

    /**
     * @param  list<int|string>  $userIds
     * @return array<int, array{current: int, longest: int, last: ?string}>
     */
    private function loadStreakState(array $userIds): array
    {
        $state = [];
        if ($userIds === []) {
            return $state;
        }

        $rows = UserStreak::query()
            ->whereIn('user_id', $userIds)
            ->where('streak_key', GamificationCatalog::STREAK_EARLY_CLOCK_IN)
            ->get();

        foreach ($rows as $row) {
            $state[(int) $row->user_id] = [
                'current' => (int) $row->current_count,
                'longest' => (int) $row->longest_count,
                'last' => $row->last_qualified_on?->toDateString(),
            ];
        }

        return $state;
    }

    /**
     * @param  array<int, array{current: int, longest: int, last: ?string}>  $streakState
     * @return array{
     *     amount: int,
     *     base: int,
     *     streak_bonus: int,
     *     streak_count: int,
     *     streak_skipped: bool,
     *     previous_streak: int,
     *     longest_streak: int,
     *     last_qualified_on: ?string
     * }
     */
    private function previewStreak(array &$streakState, int $userId, string $today, int $base): array
    {
        $state = $streakState[$userId] ?? [
            'current' => 0,
            'longest' => 0,
            'last' => null,
        ];
        $previous = (int) $state['current'];
        $last = $state['last'];

        if ($last !== null && $last > $today) {
            return [
                'amount' => $base,
                'base' => $base,
                'streak_bonus' => 0,
                'streak_count' => 1,
                'streak_skipped' => true,
                'previous_streak' => $previous,
                'longest_streak' => (int) $state['longest'],
                'last_qualified_on' => $last,
            ];
        }

        if ($last === $today) {
            $count = max(1, $previous);
            $bonus = GamificationCatalog::streakBonus($base, $count);

            return [
                'amount' => $base + $bonus,
                'base' => $base,
                'streak_bonus' => $bonus,
                'streak_count' => $count,
                'streak_skipped' => false,
                'previous_streak' => $previous,
                'longest_streak' => (int) $state['longest'],
                'last_qualified_on' => $last,
            ];
        }

        $yesterday = Carbon::parse($today)->subDay()->toDateString();
        $count = $last === $yesterday ? $previous + 1 : 1;
        $bonus = GamificationCatalog::streakBonus($base, $count);
        $longest = max((int) $state['longest'], $count);

        $streakState[$userId] = [
            'current' => $count,
            'longest' => $longest,
            'last' => $today,
        ];

        return [
            'amount' => $base + $bonus,
            'base' => $base,
            'streak_bonus' => $bonus,
            'streak_count' => $count,
            'streak_skipped' => false,
            'previous_streak' => $previous,
            'longest_streak' => $longest,
            'last_qualified_on' => $today,
        ];
    }
}
