<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quizzes', function (Blueprint $table) {
            $table->boolean('async_power_ups_enabled')->default(false)->after('sfx_pack');
        });

        Schema::table('quiz_sessions', function (Blueprint $table) {
            $table->timestamp('finished_at')->nullable()->after('pause_remaining_ms');
        });
    }

    public function down(): void
    {
        Schema::table('quizzes', function (Blueprint $table) {
            $table->dropColumn('async_power_ups_enabled');
        });

        Schema::table('quiz_sessions', function (Blueprint $table) {
            $table->dropColumn('finished_at');
        });
    }
};
