<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('department_attendance_settings', function (Blueprint $table) {
            if (! Schema::hasColumn('department_attendance_settings', 'allow_different_shift_clock_in')) {
                $table->boolean('allow_different_shift_clock_in')->default(false)->after('allow_outside_shift_hours');
            }
            if (! Schema::hasColumn('department_attendance_settings', 'shortage_enabled')) {
                $table->boolean('shortage_enabled')->default(true)->after('overtime_enabled');
            }
            if (! Schema::hasColumn('department_attendance_settings', 'count_work_from_scheduled_start')) {
                $table->boolean('count_work_from_scheduled_start')->default(true)->after('shortage_enabled');
            }
        });

        if (Schema::hasTable('app_settings') && ! Schema::hasColumn('app_settings', 'attendance_policy_sync')) {
            Schema::table('app_settings', function (Blueprint $table) {
                $table->json('attendance_policy_sync')->nullable()->after('attendance_rules');
            });
        }
    }

    public function down(): void
    {
        Schema::table('department_attendance_settings', function (Blueprint $table) {
            $drop = [];
            foreach (['allow_different_shift_clock_in', 'shortage_enabled', 'count_work_from_scheduled_start'] as $column) {
                if (Schema::hasColumn('department_attendance_settings', $column)) {
                    $drop[] = $column;
                }
            }
            if ($drop !== []) {
                $table->dropColumn($drop);
            }
        });

        if (Schema::hasTable('app_settings') && Schema::hasColumn('app_settings', 'attendance_policy_sync')) {
            Schema::table('app_settings', function (Blueprint $table) {
                $table->dropColumn('attendance_policy_sync');
            });
        }
    }
};
