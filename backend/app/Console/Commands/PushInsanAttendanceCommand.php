<?php

namespace App\Console\Commands;

use App\Services\InsanAttendancePushService;
use Carbon\Carbon;
use Illuminate\Console\Command;

class PushInsanAttendanceCommand extends Command
{
    protected $signature = 'attendance:push-to-insan
                            {--from= : Capture from (Y-m-d, relative date, or ISO8601)}
                            {--to= : Capture to (Y-m-d, relative date, or ISO8601)}
                            {--user= : Filter by user ID or email}
                            {--id=* : Specific Brain attendance_record ID(s) to push}
                            {--chunk=200 : Query chunk size}
                            {--legacy-fallback : Apply compatibility fallbacks (default reason / special-release pin) when Insan returns 422 on historical records}
                            {--legacy-reason= : Custom fallback reason for --legacy-fallback}
                            {--force : Re-push records even if already marked as synced in Brain}
                            {--dry-run : Count matching Brain records without pushing}';

    protected $description = 'Push Brain attendance punches to Insan ingest endpoint (idempotent)';

    public function handle(InsanAttendancePushService $service): int
    {
        $from = $this->parseBoundary((string) ($this->option('from') ?: ''), startOfDay: true);
        $to = $this->parseBoundary((string) ($this->option('to') ?: ''), startOfDay: false);
        $user = trim((string) ($this->option('user') ?: '')) ?: null;
        $rawIds = (array) $this->option('id');
        $recordIds = [];
        foreach ($rawIds as $raw) {
            foreach (explode(',', (string) $raw) as $part) {
                $part = trim($part);
                if ($part !== '' && ctype_digit($part)) {
                    $recordIds[] = (int) $part;
                }
            }
        }

        $chunk = (int) ($this->option('chunk') ?: 200);
        $dryRun = (bool) $this->option('dry-run');
        $legacyFallback = (bool) $this->option('legacy-fallback');
        $legacyReason = trim((string) ($this->option('legacy-reason') ?: '')) ?: null;
        $force = (bool) $this->option('force');

        try {
            $stats = $service->push(
                from: $from,
                to: $to,
                userFilter: $user,
                recordIds: $recordIds,
                dryRun: $dryRun,
                chunkSize: $chunk,
                legacyFallback: $legacyFallback,
                legacyReason: $legacyReason,
                force: $force,
            );
        } catch (\Throwable $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $this->info($dryRun ? 'Dry-run complete.' : 'Insan attendance push complete.');
        $summaryRows = collect($stats)
            ->except(['failures'])
            ->map(fn ($v, $k) => [$k, is_bool($v) ? ($v ? 'yes' : 'no') : ($v ?? '-')])
            ->values()
            ->all();

        $this->table(['Metric', 'Count'], $summaryRows);

        if (! empty($stats['failures'])) {
            $this->warn(sprintf('Showing %d failed record(s):', count($stats['failures'])));
            $this->table(
                ['Record ID', 'Email', 'Type', 'Captured At', 'Error'],
                array_map(fn (array $f) => [
                    $f['id'],
                    $f['email'] ?? '-',
                    $f['type'],
                    $f['captured_at'] ?? '-',
                    $f['error'] ?? '-',
                ], $stats['failures'])
            );
        }

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
