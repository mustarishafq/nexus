<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('department_attendance_settings')) {
            return;
        }

        if (! Schema::hasColumn('department_attendance_settings', 'sites')) {
            Schema::table('department_attendance_settings', function (Blueprint $table) {
                $table->json('sites')->nullable()->after('center_longitude');
            });
        }

        DB::table('department_attendance_settings')
            ->whereNull('sites')
            ->whereNotNull('center_latitude')
            ->whereNotNull('center_longitude')
            ->orderBy('id')
            ->each(function ($setting) {
                DB::table('department_attendance_settings')
                    ->where('id', $setting->id)
                    ->update([
                        'sites' => json_encode([
                            [
                                'name' => 'Primary location',
                                'latitude' => (float) $setting->center_latitude,
                                'longitude' => (float) $setting->center_longitude,
                            ],
                        ]),
                    ]);
            });
    }

    public function down(): void
    {
        if (! Schema::hasTable('department_attendance_settings')) {
            return;
        }

        if (Schema::hasColumn('department_attendance_settings', 'sites')) {
            Schema::table('department_attendance_settings', function (Blueprint $table) {
                $table->dropColumn('sites');
            });
        }
    }
};
