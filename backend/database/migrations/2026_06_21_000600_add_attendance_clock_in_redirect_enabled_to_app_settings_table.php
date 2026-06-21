<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('app_settings', function (Blueprint $table) {
            if (! Schema::hasColumn('app_settings', 'attendance_clock_in_redirect_enabled')) {
                $table->boolean('attendance_clock_in_redirect_enabled')->default(true);
            }
        });
    }

    public function down(): void
    {
        Schema::table('app_settings', function (Blueprint $table) {
            if (Schema::hasColumn('app_settings', 'attendance_clock_in_redirect_enabled')) {
                $table->dropColumn('attendance_clock_in_redirect_enabled');
            }
        });
    }
};
