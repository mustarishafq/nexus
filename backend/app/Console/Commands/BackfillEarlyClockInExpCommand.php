<?php

namespace App\Console\Commands;

use App\Models\AttendanceRecord;
use App\Models\ExpReward;
use App\Models\User;
use App\Services\GamificationService;
use App\Support\AttendanceLateEvaluator;
use App\Support\GamificationSettings;
use Carbon\Carbon;
use Illuminate\Console\Command;

class BackfillEarlyClockInExpCommand extends Command
{
    protected $signature = 'gamification:backfill-early-clock-in
        {--date= : Calendar date to backfill (Y-m-d). Defaults to today in app timezone.}
        {--timezone= : Timezone for the calendar date. Defaults to app timezone.}
        {--user= : Limit to one user id or email}
        {--status=pending : Reward status after backfill (pending or claimed)}
        {--dry-run : List eligible users without creating rewards}';

    protected $description = 'Offer missed clock_in_early EXP for clock-ins that fall inside the early window';

    public function handle(GamificationService $gamification): int
    {
        $timezone = (string) ($this->option('timezone') ?: config('app.timezone'));
        $date = (string) ($this->option('date') ?: now($timezone)->toDateString());
        $dryRun = (bool) $this->option('dry-run');
        $userFilter = trim((string) ($this->option('user') ?: ''));
        $status = strtolower(trim((string) ($this->option('status') ?: ExpReward::STATUS_PENDING)));

        if (! in_array($status, [ExpReward::STATUS_PENDING, ExpReward::STATUS_CLAIMED], true)) {
            $this->error('Invalid --status. Use pending or claimed.');

            return self::FAILURE;
        }

        try {
            $dayStart = Carbon::parse($date, $timezone)->startOfDay();
            $dayEnd = Carbon::parse($date, $timezone)->endOfDay();
        } catch (\Throwable) {
            $this->error('Invalid --date. Use Y-m-d.');

            return self::FAILURE;
        }

        $userId = null;
        if ($userFilter !== '') {
            $matched = ctype_digit($userFilter)
                ? User::query()->find((int) $userFilter)
                : User::query()->where('email', $userFilter)->first();

            if (! $matched) {
                $this->error("User not found: {$userFilter}");

                return self::FAILURE;
            }

            $userId = (int) $matched->id;
            $this->info(sprintf(
                'Scoped to user #%d (%s)',
                $matched->id,
                $matched->email ?? $matched->full_name ?? 'unknown',
            ));
        }

        $cutoff = GamificationSettings::earlyClockInCutoffMinutes();
        $window = GamificationSettings::earlyClockInWindowMinutes();

        $this->info(sprintf(
            '%s early clock-in backfill for %s (%s). Window=%d min, cutoff=%d min, status=%s.',
            $dryRun ? '[dry-run]' : 'Running',
            $date,
            $timezone,
            $window,
            $cutoff,
            $status,
        ));

        $recordsQuery = AttendanceRecord::query()
            ->with('user')
            ->where('type', 'clock_in')
            ->whereBetween('captured_at', [
                $dayStart->copy()->timezone(config('app.timezone')),
                $dayEnd->copy()->timezone(config('app.timezone')),
            ])
            ->orderBy('captured_at');

        if ($userId !== null) {
            $recordsQuery->where('user_id', $userId);
        }

        $records = $recordsQuery->get();

        $offered = 0;
        $skipped = 0;
        $ineligible = 0;

        foreach ($records as $record) {
            /** @var User|null $user */
            $user = $record->user;
            if (! $user) {
                $skipped++;
                continue;
            }

            $already = ExpReward::query()
                ->where('user_id', $user->id)
                ->where('action_key', 'clock_in_early')
                ->where('source_type', 'attendance_record')
                ->where('source_id', (string) $record->id)
                ->exists();

            if ($already) {
                $skipped++;
                continue;
            }

            $capturedAt = $record->captured_at instanceof Carbon
                ? $record->captured_at->copy()
                : Carbon::parse($record->captured_at);

            $late = AttendanceLateEvaluator::evaluate($user, $capturedAt);
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

            $label = sprintf(
                'user #%d %s @ %s (record #%d)',
                $user->id,
                $user->email ?? $user->full_name ?? 'unknown',
                $capturedAt->timezone($timezone)->toDateTimeString(),
                $record->id,
            );

            if ($dryRun) {
                $this->line("would {$status}: {$label}");
                $offered++;
                continue;
            }

            $reward = $gamification->offer($user, 'clock_in_early', 'attendance_record', $record->id);
            if (! $reward) {
                $this->warn("skipped (cap/dedupe): {$label}");
                $skipped++;
                continue;
            }

            if ($status === ExpReward::STATUS_CLAIMED) {
                $claimed = $gamification->claim($user, $reward);
                $this->line("claimed +{$claimed->amount} EXP: {$label}");
            } else {
                $this->line("pending +{$reward->amount} EXP: {$label}");
            }

            $offered++;
        }

        $this->newLine();
        $this->info(sprintf(
            'Done. %s=%d, already-had/skipped=%d, ineligible=%d, scanned=%d',
            $dryRun ? 'would_'.$status : $status,
            $offered,
            $skipped,
            $ineligible,
            $records->count(),
        ));

        if ($dryRun) {
            $this->comment('Re-run without --dry-run to create rewards.');
        } elseif ($status === ExpReward::STATUS_PENDING) {
            $this->comment('Rewards are pending — users claim them from Missions.');
        } else {
            $this->comment('Rewards were claimed immediately — EXP totals already updated.');
        }

        return self::SUCCESS;
    }
}
