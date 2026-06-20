<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('app_settings', function (Blueprint $table) {
            $table->string('splash_background_style', 24)->default('solid')->after('splash_background_overlay_opacity');
            $table->unsignedSmallInteger('splash_background_gradient_angle')->default(135)->after('splash_background_style');
            $table->unsignedTinyInteger('splash_background_blur')->default(0)->after('splash_background_gradient_angle');
        });
    }

    public function down(): void
    {
        Schema::table('app_settings', function (Blueprint $table) {
            $table->dropColumn([
                'splash_background_style',
                'splash_background_gradient_angle',
                'splash_background_blur',
            ]);
        });
    }
};
