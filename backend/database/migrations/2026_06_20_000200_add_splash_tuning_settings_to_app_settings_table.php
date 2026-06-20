<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('app_settings', function (Blueprint $table) {
            $table->boolean('splash_enabled')->default(true)->after('splash_animation_style');
            $table->string('splash_background_color', 7)->default('#022e96')->after('splash_enabled');
            $table->string('splash_accent_color', 7)->default('#FA9D04')->after('splash_background_color');
            $table->string('splash_secondary_color', 7)->default('#017CF3')->after('splash_accent_color');
            $table->unsignedSmallInteger('splash_min_duration_ms')->default(1200)->after('splash_secondary_color');
            $table->unsignedSmallInteger('splash_max_duration_ms')->default(6000)->after('splash_min_duration_ms');
            $table->unsignedTinyInteger('splash_speed_percent')->default(100)->after('splash_max_duration_ms');
            $table->unsignedSmallInteger('splash_exit_fade_ms')->default(450)->after('splash_speed_percent');
            $table->unsignedTinyInteger('splash_logo_scale_percent')->default(100)->after('splash_exit_fade_ms');
        });
    }

    public function down(): void
    {
        Schema::table('app_settings', function (Blueprint $table) {
            $table->dropColumn([
                'splash_enabled',
                'splash_background_color',
                'splash_accent_color',
                'splash_secondary_color',
                'splash_min_duration_ms',
                'splash_max_duration_ms',
                'splash_speed_percent',
                'splash_exit_fade_ms',
                'splash_logo_scale_percent',
            ]);
        });
    }
};
