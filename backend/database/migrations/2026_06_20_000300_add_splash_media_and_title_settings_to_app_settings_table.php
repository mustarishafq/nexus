<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('app_settings', function (Blueprint $table) {
            $table->string('splash_logo_url', 2048)->nullable()->after('splash_logo_scale_percent');
            $table->boolean('splash_show_logo')->default(true)->after('splash_logo_url');
            $table->string('splash_media_fit', 16)->default('contain')->after('splash_show_logo');
            $table->boolean('splash_video_loop')->default(true)->after('splash_media_fit');
            $table->boolean('splash_video_muted')->default(true)->after('splash_video_loop');
            $table->boolean('splash_show_system_name')->default(false)->after('splash_video_muted');
            $table->string('splash_system_name_animation', 32)->default('fade-rise')->after('splash_show_system_name');
            $table->string('splash_system_name_color', 7)->default('#FFFFFF')->after('splash_system_name_animation');
            $table->unsignedTinyInteger('splash_system_name_size_percent')->default(100)->after('splash_system_name_color');
            $table->string('splash_system_name_position', 16)->default('below')->after('splash_system_name_size_percent');
            $table->unsignedTinyInteger('splash_backdrop_blur')->default(0)->after('splash_system_name_position');
            $table->unsignedTinyInteger('splash_background_overlay_opacity')->default(0)->after('splash_backdrop_blur');
        });
    }

    public function down(): void
    {
        Schema::table('app_settings', function (Blueprint $table) {
            $table->dropColumn([
                'splash_logo_url',
                'splash_show_logo',
                'splash_media_fit',
                'splash_video_loop',
                'splash_video_muted',
                'splash_show_system_name',
                'splash_system_name_animation',
                'splash_system_name_color',
                'splash_system_name_size_percent',
                'splash_system_name_position',
                'splash_backdrop_blur',
                'splash_background_overlay_opacity',
            ]);
        });
    }
};
