<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quiz_sessions', function (Blueprint $table) {
            // Bumped inside the same locked transaction as every authoritative
            // phase transition. Lets a delayed job (or a client) cheaply tell
            // whether the transition it was scheduled/observed for is still
            // current, without needing to take the row lock to find out.
            $table->unsignedBigInteger('state_version')->default(0)->after('pause_remaining_ms');
        });
    }

    public function down(): void
    {
        Schema::table('quiz_sessions', function (Blueprint $table) {
            $table->dropColumn('state_version');
        });
    }
};
