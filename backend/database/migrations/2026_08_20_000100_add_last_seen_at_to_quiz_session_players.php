<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quiz_session_players', function (Blueprint $table) {
            if (! Schema::hasColumn('quiz_session_players', 'last_seen_at')) {
                $table->timestamp('last_seen_at')->nullable()->after('joined_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('quiz_session_players', function (Blueprint $table) {
            if (Schema::hasColumn('quiz_session_players', 'last_seen_at')) {
                $table->dropColumn('last_seen_at');
            }
        });
    }
};
