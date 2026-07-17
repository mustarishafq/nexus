<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * One-time correction for datetimes saved as UTC wall-clock while APP_TIMEZONE
 * was non-UTC (SPA toISOString() payloads).
 *
 * Stored "13:30:00" that actually meant 13:30 UTC becomes the APP_TIMEZONE
 * wall clock (e.g. 21:30:00 for Asia/Kuala_Lumpur).
 *
 * Uses the query builder (not Eloquent) so UsesAppTimezone does not re-convert.
 * No-op when APP_TIMEZONE is UTC.
 *
 * Optional cutoff (only rows created before this instant):
 *   TIMEZONE_DATA_FIX_BEFORE="2026-07-17 04:00:00"
 * Defaults to "now" when the migration starts — run soon after deploying the
 * timezone write fix so newly corrected rows are not shifted again.
 */
return new class extends Migration
{
    /**
     * @return array<string, array{0: string, 1?: \Closure}>
     */
    private function targets(): array
    {
        return [
            'attendance_records' => ['captured_at'],
            'broadcasts' => ['broadcast_starts_at', 'broadcast_ends_at'],
            'network_health_logs' => ['tested_at'],
            'notifications' => [
                'broadcast_starts_at',
                'broadcast_ends_at',
                'read_at',
                'snoozed_until',
            ],
            // Admin/SPA calendar creates; webhook rows with local times are skipped.
            'calendar_events' => ['start_at', 'end_at'],
        ];
    }

    public function up(): void
    {
        $this->convert(reverse: false);
    }

    public function down(): void
    {
        $this->convert(reverse: true);
    }

    private function convert(bool $reverse): void
    {
        $appTimezone = (string) config('app.timezone');

        if ($appTimezone === '' || strtoupper($appTimezone) === 'UTC') {
            return;
        }

        $cutoff = $this->cutoff();

        foreach ($this->targets() as $table => $columns) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            $columns = array_values(array_filter(
                $columns,
                fn (string $column) => Schema::hasColumn($table, $column)
            ));

            if ($columns === []) {
                continue;
            }

            $query = DB::table($table)->orderBy('id');

            if (Schema::hasColumn($table, 'created_at') && $cutoff !== null) {
                $query->where('created_at', '<', $cutoff);
            }

            // Prefer SPA-created calendar events; webhook/local mappings stay put.
            if ($table === 'calendar_events' && Schema::hasColumn($table, 'external_event_id')) {
                $query->whereNull('external_event_id');
            }

            $query->chunkById(200, function ($rows) use ($table, $columns, $appTimezone, $reverse) {
                foreach ($rows as $row) {
                    $updates = [];

                    foreach ($columns as $column) {
                        $value = $row->{$column} ?? null;

                        if ($value === null || $value === '') {
                            continue;
                        }

                        $updates[$column] = $reverse
                            ? Carbon::parse((string) $value, $appTimezone)->utc()->format('Y-m-d H:i:s')
                            : Carbon::parse((string) $value, 'UTC')->timezone($appTimezone)->format('Y-m-d H:i:s');
                    }

                    if ($updates !== []) {
                        DB::table($table)->where('id', $row->id)->update($updates);
                    }
                }
            });
        }
    }

    private function cutoff(): ?string
    {
        $configured = env('TIMEZONE_DATA_FIX_BEFORE');

        if (filled($configured)) {
            return Carbon::parse((string) $configured, config('app.timezone'))
                ->format('Y-m-d H:i:s');
        }

        return now()->format('Y-m-d H:i:s');
    }
};
