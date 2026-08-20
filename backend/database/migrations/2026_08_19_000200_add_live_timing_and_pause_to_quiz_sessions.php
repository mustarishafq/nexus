<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quiz_sessions', function (Blueprint $table) {
            if (! Schema::hasColumn('quiz_sessions', 'question_ends_at')) {
                $table->timestamp('question_ends_at')->nullable()->after('question_started_at');
            }
            if (! Schema::hasColumn('quiz_sessions', 'host_last_seen_at')) {
                $table->timestamp('host_last_seen_at')->nullable()->after('sfx_pack');
            }
            if (! Schema::hasColumn('quiz_sessions', 'paused_at')) {
                $table->timestamp('paused_at')->nullable()->after('host_last_seen_at');
            }
            if (! Schema::hasColumn('quiz_sessions', 'pause_remaining_ms')) {
                $table->unsignedInteger('pause_remaining_ms')->nullable()->after('paused_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('quiz_sessions', function (Blueprint $table) {
            $table->dropColumn([
                'question_ends_at',
                'host_last_seen_at',
                'paused_at',
                'pause_remaining_ms',
            ]);
        });
    }
};
