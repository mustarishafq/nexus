<?php

namespace App\Console\Commands;

use App\Services\InsanAttendancePullService;
use Carbon\Carbon;
use Illuminate\Console\Command;

class PullInsanAttendanceCommand extends Command
{
    protected $signature = 'attendance:pull-from-insan
                            {--from= : Capture from (Y-m-d or ISO8601)}
                            {--to= : Capture to (Y-m-d or ISO8601)}
                            {--offer-exp : Also offer clock-in / early / clock-out missions}
                            {--dry-run : Count matches without writing}';

    protected $description = 'Pull attendance punches from Insan into Brain (idempotent)';

    public function handle(InsanAttendancePullService $service): int
    {
        $from = $this->option('from') ? Carbon::parse((string) $this->option('from')) : null;
        $to = $this->option('to') ? Carbon::parse((string) $this->option('to')) : null;
        $dryRun = (bool) $this->option('dry-run');
        $offerExp = (bool) $this->option('offer-exp');

        try {
            $stats = $service->pull($from, $to, $dryRun, $offerExp);
        } catch (\Throwable $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $this->info($dryRun ? 'Dry-run complete.' : 'Insan attendance pull complete.');
        $this->table(
            ['Metric', 'Count'],
            collect($stats)->map(fn ($v, $k) => [$k, is_bool($v) ? ($v ? 'yes' : 'no') : $v])->values()->all()
        );

        return self::SUCCESS;
    }
}
