<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('app_settings', function (Blueprint $table) {
            if (! Schema::hasColumn('app_settings', 'attendance_watermark_logo_position')) {
                $table->string('attendance_watermark_logo_position', 16)->default('center');
            }
        });
    }

    public function down(): void
    {
        Schema::table('app_settings', function (Blueprint $table) {
            if (Schema::hasColumn('app_settings', 'attendance_watermark_logo_position')) {
                $table->dropColumn('attendance_watermark_logo_position');
            }
        });
    }
};
