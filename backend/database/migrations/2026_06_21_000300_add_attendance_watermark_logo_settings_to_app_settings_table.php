<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('app_settings', function (Blueprint $table) {
            if (! Schema::hasColumn('app_settings', 'attendance_watermark_show_logo')) {
                $table->boolean('attendance_watermark_show_logo')->default(false);
            }
            if (! Schema::hasColumn('app_settings', 'attendance_watermark_logo_url')) {
                $table->string('attendance_watermark_logo_url', 2048)->nullable();
            }
            if (! Schema::hasColumn('app_settings', 'attendance_watermark_logo_size_percent')) {
                $table->unsignedSmallInteger('attendance_watermark_logo_size_percent')->default(100);
            }
            if (! Schema::hasColumn('app_settings', 'attendance_watermark_logo_opacity')) {
                $table->unsignedTinyInteger('attendance_watermark_logo_opacity')->default(100);
            }
        });
    }

    public function down(): void
    {
        Schema::table('app_settings', function (Blueprint $table) {
            foreach ([
                'attendance_watermark_show_logo',
                'attendance_watermark_logo_url',
                'attendance_watermark_logo_size_percent',
                'attendance_watermark_logo_opacity',
            ] as $column) {
                if (Schema::hasColumn('app_settings', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
