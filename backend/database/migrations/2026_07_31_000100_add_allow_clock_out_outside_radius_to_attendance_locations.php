<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attendance_locations', function (Blueprint $table) {
            $table->boolean('allow_clock_out_outside_radius')->default(false)->after('allow_outside_radius');
        });

        // Preserve previous behaviour: one flag applied to both clock-in and clock-out.
        DB::table('attendance_locations')->update([
            'allow_clock_out_outside_radius' => DB::raw('allow_outside_radius'),
        ]);
    }

    public function down(): void
    {
        Schema::table('attendance_locations', function (Blueprint $table) {
            $table->dropColumn('allow_clock_out_outside_radius');
        });
    }
};
