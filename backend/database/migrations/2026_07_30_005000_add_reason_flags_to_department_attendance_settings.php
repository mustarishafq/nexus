<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('department_attendance_settings', function (Blueprint $table) {
            $table->boolean('require_early_clock_out_reason')->default(false)->after('grace_period_minutes');
            $table->boolean('require_late_clock_in_reason')->default(false)->after('require_early_clock_out_reason');
        });
    }

    public function down(): void
    {
        Schema::table('department_attendance_settings', function (Blueprint $table) {
            $table->dropColumn([
                'require_early_clock_out_reason',
                'require_late_clock_in_reason',
            ]);
        });
    }
};
