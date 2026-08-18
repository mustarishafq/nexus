<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quizzes', function (Blueprint $table) {
            $table->string('bgm_theme', 40)->default('party')->after('status');
            $table->string('sfx_pack', 40)->default('classic')->after('bgm_theme');
        });

        Schema::table('quiz_sessions', function (Blueprint $table) {
            $table->string('bgm_theme', 40)->default('party')->after('music_enabled');
            $table->string('sfx_pack', 40)->default('classic')->after('bgm_theme');
        });
    }

    public function down(): void
    {
        Schema::table('quizzes', function (Blueprint $table) {
            $table->dropColumn(['bgm_theme', 'sfx_pack']);
        });

        Schema::table('quiz_sessions', function (Blueprint $table) {
            $table->dropColumn(['bgm_theme', 'sfx_pack']);
        });
    }
};
