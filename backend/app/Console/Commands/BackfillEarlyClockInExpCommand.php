<?php

namespace App\Console\Commands;

use App\Models\ExpReward;
use App\Services\EarlyClockInBackfillService;
use Illuminate\Console\Command;
use InvalidArgumentException;

class BackfillEarlyClockInExpCommand extends Command
{
    protected $signature = 'gamification:backfill-early-clock-in
        {--date= : Calendar date to backfill (Y-m-d). Defaults to today in app timezone.}
        {--date-to= : Optional end date (Y-m-d). Defaults to --date.}
        {--timezone= : Timezone for the calendar date. Defaults to app timezone.}
        {--user= : Limit to one user id or email}
        {--status=pending : Reward status after backfill (pending or claimed)}
        {--dry-run : List eligible users without creating rewards}';

    protected $description = 'Offer missed clock_in_early EXP for clock-ins that fall inside the early window';

    public function handle(EarlyClockInBackfillService $backfill): int
    {
        $timezone = (string) ($this->option('timezone') ?: config('app.timezone'));
        $date = (string) ($this->option('date') ?: now($timezone)->toDateString());
        $dateTo = trim((string) ($this->option('date-to') ?: '')) ?: null;

        try {
            $stats = $backfill->run(
                date: $date,
                dateTo: $dateTo,
                userFilter: trim((string) ($this->option('user') ?: '')) ?: null,
                status: strtolower(trim((string) ($this->option('status') ?: ExpReward::STATUS_PENDING))),
                dryRun: (bool) $this->option('dry-run'),
                timezone: $timezone,
            );
        } catch (InvalidArgumentException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $this->info(sprintf(
            '%s early clock-in backfill for %s%s (%s). Window=%d min, cutoff=%d min, status=%s.',
            $stats['dry_run'] ? '[dry-run]' : 'Running',
            $stats['date'],
            $stats['date_to'] !== $stats['date'] ? ' to '.$stats['date_to'] : '',
            $stats['timezone'],
            $stats['window_minutes'],
            $stats['cutoff_minutes'],
            $stats['status'],
        ));

        if ($stats['user_id']) {
            $this->info(sprintf('Scoped to user #%d (%s)', $stats['user_id'], $stats['user_email'] ?? 'unknown'));
        }

        foreach ($stats['items'] as $item) {
            $this->line(sprintf(
                '%s: user #%d %s @ %s (record #%d) +%d EXP, %s',
                $item['status'],
                $item['user_id'],
                $item['email'] ?? $item['name'] ?? 'unknown',
                $item['captured_at'],
                $item['record_id'],
                (int) ($item['amount'] ?? 0),
                ! empty($item['streak_skipped'])
                    ? 'streak skipped (later '.$item['last_qualified_on'].')'
                    : sprintf('%d-day streak%s', (int) ($item['streak_count'] ?? 1), ((int) ($item['streak_bonus'] ?? 0)) > 0 ? ' +'.$item['streak_bonus'].' bonus' : ''),
            ));
        }

        $this->newLine();
        $this->info(sprintf(
            'Done. %s=%d, already_granted=%d, skipped=%d, ineligible=%d, scanned=%d',
            $stats['dry_run'] ? 'would_'.$stats['status'] : $stats['status'],
            $stats['offered'],
            $stats['already_granted'] ?? 0,
            $stats['skipped'],
            $stats['ineligible'],
            $stats['scanned'],
        ));

        if ($stats['dry_run']) {
            $this->comment('Re-run without --dry-run to create rewards.');
        } elseif ($stats['status'] === ExpReward::STATUS_PENDING) {
            $this->comment('Rewards are pending — users claim them from Missions.');
        } else {
            $this->comment('Rewards were claimed immediately — EXP totals already updated.');
        }

        return self::SUCCESS;
    }
}
