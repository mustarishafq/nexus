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

        if (! Schema::hasColumn('department_attendance_settings', 'attendance_location_id')) {
            Schema::table('department_attendance_settings', function (Blueprint $table) {
                $table->foreignId('attendance_location_id')
                    ->nullable()
                    ->after('department_id')
                    ->constrained('attendance_locations')
                    ->nullOnDelete();
            });
        }

        if (! Schema::hasColumn('department_attendance_settings', 'geofence_enabled')) {
            return;
        }

        $departments = DB::table('departments')->pluck('name', 'id');

        DB::table('department_attendance_settings')
            ->orderBy('id')
            ->each(function ($setting) use ($departments) {
                $departmentName = $departments[$setting->department_id] ?? 'Department';
                $sites = $setting->sites ? json_decode($setting->sites, true) : null;

                $locationId = DB::table('attendance_locations')->insertGetId([
                    'name' => $departmentName.' location',
                    'geofence_enabled' => (bool) $setting->geofence_enabled,
                    'center_latitude' => $setting->center_latitude,
                    'center_longitude' => $setting->center_longitude,
                    'sites' => $sites ? json_encode($sites) : null,
                    'radius_meters' => $setting->radius_meters ?? 200,
                    'allow_outside_radius' => (bool) $setting->allow_outside_radius,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                DB::table('department_attendance_settings')
                    ->where('id', $setting->id)
                    ->update(['attendance_location_id' => $locationId]);
            });

        Schema::table('department_attendance_settings', function (Blueprint $table) {
            $table->dropColumn([
                'geofence_enabled',
                'center_latitude',
                'center_longitude',
                'sites',
                'radius_meters',
                'allow_outside_radius',
            ]);
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('department_attendance_settings')) {
            return;
        }

        if (! Schema::hasColumn('department_attendance_settings', 'geofence_enabled')) {
            Schema::table('department_attendance_settings', function (Blueprint $table) {
                $table->boolean('geofence_enabled')->default(false)->after('enabled');
                $table->decimal('center_latitude', 10, 7)->nullable()->after('geofence_enabled');
                $table->decimal('center_longitude', 10, 7)->nullable()->after('center_latitude');
                $table->json('sites')->nullable()->after('center_longitude');
                $table->unsignedInteger('radius_meters')->default(200)->after('sites');
                $table->boolean('allow_outside_radius')->default(false)->after('radius_meters');
            });
        }

        DB::table('department_attendance_settings')
            ->whereNotNull('attendance_location_id')
            ->orderBy('id')
            ->each(function ($setting) {
                $location = DB::table('attendance_locations')
                    ->where('id', $setting->attendance_location_id)
                    ->first();

                if (! $location) {
                    return;
                }

                DB::table('department_attendance_settings')
                    ->where('id', $setting->id)
                    ->update([
                        'geofence_enabled' => $location->geofence_enabled,
                        'center_latitude' => $location->center_latitude,
                        'center_longitude' => $location->center_longitude,
                        'sites' => $location->sites,
                        'radius_meters' => $location->radius_meters,
                        'allow_outside_radius' => $location->allow_outside_radius,
                    ]);
            });

        if (Schema::hasColumn('department_attendance_settings', 'attendance_location_id')) {
            Schema::table('department_attendance_settings', function (Blueprint $table) {
                $table->dropConstrainedForeignId('attendance_location_id');
            });
        }
    }
};
