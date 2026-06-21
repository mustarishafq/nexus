<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('app_settings', function (Blueprint $table) {
            if (! Schema::hasColumn('app_settings', 'attendance_enabled')) {
                $table->boolean('attendance_enabled')->default(true);
            }
            if (! Schema::hasColumn('app_settings', 'attendance_watermark_show_datetime')) {
                $table->boolean('attendance_watermark_show_datetime')->default(true);
            }
            if (! Schema::hasColumn('app_settings', 'attendance_watermark_show_date')) {
                $table->boolean('attendance_watermark_show_date')->default(true);
            }
            if (! Schema::hasColumn('app_settings', 'attendance_watermark_show_time')) {
                $table->boolean('attendance_watermark_show_time')->default(true);
            }
            if (! Schema::hasColumn('app_settings', 'attendance_watermark_datetime_format')) {
                $table->string('attendance_watermark_datetime_format', 32)->default('full');
            }
            if (! Schema::hasColumn('app_settings', 'attendance_watermark_show_location')) {
                $table->boolean('attendance_watermark_show_location')->default(true);
            }
            if (! Schema::hasColumn('app_settings', 'attendance_watermark_show_coordinates')) {
                $table->boolean('attendance_watermark_show_coordinates')->default(true);
            }
            if (! Schema::hasColumn('app_settings', 'attendance_watermark_show_user_name')) {
                $table->boolean('attendance_watermark_show_user_name')->default(true);
            }
            if (! Schema::hasColumn('app_settings', 'attendance_watermark_show_device_info')) {
                $table->boolean('attendance_watermark_show_device_info')->default(false);
            }
            if (! Schema::hasColumn('app_settings', 'attendance_watermark_show_custom_text')) {
                $table->boolean('attendance_watermark_show_custom_text')->default(false);
            }
            if (! Schema::hasColumn('app_settings', 'attendance_watermark_custom_text')) {
                $table->string('attendance_watermark_custom_text', 255)->nullable();
            }
            if (! Schema::hasColumn('app_settings', 'attendance_watermark_font_size_percent')) {
                $table->unsignedSmallInteger('attendance_watermark_font_size_percent')->default(100);
            }
            if (! Schema::hasColumn('app_settings', 'attendance_watermark_text_color')) {
                $table->string('attendance_watermark_text_color', 16)->default('#FFFFFF');
            }
            if (! Schema::hasColumn('app_settings', 'attendance_watermark_background_color')) {
                $table->string('attendance_watermark_background_color', 16)->default('#000000');
            }
            if (! Schema::hasColumn('app_settings', 'attendance_watermark_background_opacity')) {
                $table->unsignedTinyInteger('attendance_watermark_background_opacity')->default(45);
            }
            if (! Schema::hasColumn('app_settings', 'attendance_watermark_position')) {
                $table->string('attendance_watermark_position', 32)->default('bottom-left');
            }
            if (! Schema::hasColumn('app_settings', 'attendance_watermark_margin_percent')) {
                $table->unsignedTinyInteger('attendance_watermark_margin_percent')->default(3);
            }
        });
    }

    public function down(): void
    {
        Schema::table('app_settings', function (Blueprint $table) {
            $columns = [
                'attendance_enabled',
                'attendance_watermark_show_datetime',
                'attendance_watermark_show_date',
                'attendance_watermark_show_time',
                'attendance_watermark_datetime_format',
                'attendance_watermark_show_location',
                'attendance_watermark_show_coordinates',
                'attendance_watermark_show_user_name',
                'attendance_watermark_show_device_info',
                'attendance_watermark_show_custom_text',
                'attendance_watermark_custom_text',
                'attendance_watermark_font_size_percent',
                'attendance_watermark_text_color',
                'attendance_watermark_background_color',
                'attendance_watermark_background_opacity',
                'attendance_watermark_position',
                'attendance_watermark_margin_percent',
            ];

            foreach ($columns as $column) {
                if (Schema::hasColumn('app_settings', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
