<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('app_settings', function (Blueprint $table) {
            if (! Schema::hasColumn('app_settings', 'launch_animation_style')) {
                $table->string('launch_animation_style', 32)->default('warp');
            }
            if (! Schema::hasColumn('app_settings', 'launch_overlay_mode')) {
                $table->string('launch_overlay_mode', 32)->default('fullscreen')->after('launch_animation_style');
            }
            if (! Schema::hasColumn('app_settings', 'launch_progress_style')) {
                $table->string('launch_progress_style', 32)->default('bar')->after('launch_overlay_mode');
            }
            if (! Schema::hasColumn('app_settings', 'launch_duration')) {
                $table->string('launch_duration', 16)->default('normal')->after('launch_progress_style');
            }
            if (! Schema::hasColumn('app_settings', 'launch_interactive')) {
                $table->boolean('launch_interactive')->default(true)->after('launch_duration');
            }
            if (! Schema::hasColumn('app_settings', 'launch_show_skip')) {
                $table->boolean('launch_show_skip')->default(true)->after('launch_interactive');
            }
            if (! Schema::hasColumn('app_settings', 'launch_show_hint')) {
                $table->boolean('launch_show_hint')->default(true)->after('launch_show_skip');
            }
        });
    }

    public function down(): void
    {
        Schema::table('app_settings', function (Blueprint $table) {
            $columns = [
                'launch_animation_style',
                'launch_overlay_mode',
                'launch_progress_style',
                'launch_duration',
                'launch_interactive',
                'launch_show_skip',
                'launch_show_hint',
            ];

            foreach ($columns as $column) {
                if (Schema::hasColumn('app_settings', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
