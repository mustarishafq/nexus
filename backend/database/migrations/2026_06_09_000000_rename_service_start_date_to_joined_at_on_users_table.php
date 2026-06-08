<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasColumn('users', 'service_start_date')) {
            Schema::table('users', function (Blueprint $table) {
                $table->renameColumn('service_start_date', 'joined_at');
            });
        }

        if (! Schema::hasColumn('users', 'joined_at') && ! Schema::hasColumn('users', 'service_start_date')) {
            Schema::table('users', function (Blueprint $table) {
                $table->date('joined_at')->nullable()->after('remember_token');
            });
        }

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            if (Schema::hasColumn('users', 'date_of_birth')) {
                DB::statement('ALTER TABLE users MODIFY COLUMN date_of_birth DATE NULL AFTER remember_token');
            }

            if (Schema::hasColumn('users', 'joined_at')) {
                DB::statement('ALTER TABLE users MODIFY COLUMN joined_at DATE NULL AFTER date_of_birth');
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'mysql') {
            if (Schema::hasColumn('users', 'date_of_birth')) {
                DB::statement('ALTER TABLE users MODIFY COLUMN date_of_birth DATE NULL AFTER notification_settings');
            }
        }

        if (Schema::hasColumn('users', 'joined_at')) {
            Schema::table('users', function (Blueprint $table) {
                $table->renameColumn('joined_at', 'service_start_date');
            });

            if (Schema::getConnection()->getDriverName() === 'mysql' && Schema::hasColumn('users', 'service_start_date')) {
                DB::statement('ALTER TABLE users MODIFY COLUMN service_start_date DATE NULL AFTER date_of_birth');
            }
        }
    }
};
