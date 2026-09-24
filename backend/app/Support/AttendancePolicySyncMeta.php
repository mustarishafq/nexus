<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AttendancePolicySyncMeta
{
    /**
     * @return array{last_synced_at?: string, last_direction?: string, last_stats?: array<string, mixed>}|null
     */
    public static function current(): ?array
    {
        if (! Schema::hasTable('app_settings') || ! Schema::hasColumn('app_settings', 'attendance_policy_sync')) {
            return null;
        }

        $row = AppSettings::row();
        $value = $row->attendance_policy_sync ?? null;
        if (is_string($value) && $value !== '') {
            $decoded = json_decode($value, true);
            $value = is_array($decoded) ? $decoded : null;
        }

        return is_array($value) && $value !== [] ? $value : null;
    }

    /**
     * @param  array{last_synced_at?: string, last_direction?: string, last_stats?: array<string, mixed>}  $meta
     */
    public static function store(array $meta): void
    {
        if (! Schema::hasTable('app_settings') || ! Schema::hasColumn('app_settings', 'attendance_policy_sync')) {
            return;
        }

        $encoded = json_encode($meta);
        $existing = DB::table('app_settings')->first();
        if ($existing) {
            DB::table('app_settings')->where('id', $existing->id)->update([
                'attendance_policy_sync' => $encoded,
                'updated_at' => now(),
            ]);
        } else {
            DB::table('app_settings')->insert([
                'system_name' => config('app.name', 'EMZI Nexus Brain'),
                'attendance_policy_sync' => $encoded,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        AppSettings::forget();
    }

    /**
     * @param  array<string, mixed>  $stats
     */
    public static function mark(string $direction, array $stats = []): void
    {
        self::store([
            'last_synced_at' => now()->toIso8601String(),
            'last_direction' => $direction,
            'last_stats' => $stats,
        ]);
    }
}
