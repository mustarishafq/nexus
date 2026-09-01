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
                            {--offer-exp : Offer clock-in / early / clock-out missions for every imported punch}
                            {--offer-exp-on= : Offer missions only for punches on this calendar date (Y-m-d)}
                            {--dry-run : Count matches without writing}';

    protected $description = 'Pull attendance punches from Insan into Brain (idempotent)';

    public function handle(InsanAttendancePullService $service): int
    {
        $from = $this->parseBoundary((string) ($this->option('from') ?: ''), startOfDay: true);
        $to = $this->parseBoundary((string) ($this->option('to') ?: ''), startOfDay: false);
        $dryRun = (bool) $this->option('dry-run');
        $offerExp = (bool) $this->option('offer-exp');
        $offerExpOn = trim((string) ($this->option('offer-exp-on') ?: '')) ?: null;

        try {
            $stats = $service->pull($from, $to, $dryRun, $offerExp, $offerExpOn);
        } catch (\Throwable $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $this->info($dryRun ? 'Dry-run complete.' : 'Insan attendance pull complete.');
        $this->table(
            ['Metric', 'Count'],
            collect($stats)->map(fn ($v, $k) => [$k, is_bool($v) ? ($v ? 'yes' : 'no') : ($v ?? '-')])->values()->all()
        );

        return self::SUCCESS;
    }

    private function parseBoundary(string $value, bool $startOfDay): ?Carbon
    {
        $value = trim($value);
        if ($value === '') {
            return null;
        }

        $parsed = Carbon::parse($value);
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) === 1) {
            return $startOfDay ? $parsed->startOfDay() : $parsed->endOfDay();
        }

        return $parsed;
    }
}
