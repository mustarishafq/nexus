<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'attendance_shift_ids')) {
            Schema::table('users', function (Blueprint $table) {
                $table->json('attendance_shift_ids')->nullable()->after('department_id');
            });
        }

        if (! Schema::hasColumn('users', 'attendance_shift_location_ids')) {
            Schema::table('users', function (Blueprint $table) {
                $table->json('attendance_shift_location_ids')->nullable()->after('attendance_shift_ids');
            });
        }

        if (! Schema::hasColumn('attendance_locations', 'owner_user_id')) {
            Schema::table('attendance_locations', function (Blueprint $table) {
                $table->foreignId('owner_user_id')
                    ->nullable()
                    ->after('id')
                    ->constrained('users')
                    ->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('attendance_locations', 'owner_user_id')) {
            Schema::table('attendance_locations', function (Blueprint $table) {
                $table->dropConstrainedForeignId('owner_user_id');
            });
        }

        if (Schema::hasColumn('users', 'attendance_shift_location_ids')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('attendance_shift_location_ids');
            });
        }

        if (Schema::hasColumn('users', 'attendance_shift_ids')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('attendance_shift_ids');
            });
        }
    }
};
