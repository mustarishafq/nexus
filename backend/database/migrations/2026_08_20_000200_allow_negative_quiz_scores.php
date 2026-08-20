<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'mysql') {
            return;
        }

        DB::statement('ALTER TABLE quiz_session_players MODIFY score INT NOT NULL DEFAULT 0');
        DB::statement('ALTER TABLE quiz_session_answers MODIFY points_awarded INT NOT NULL DEFAULT 0');
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'mysql') {
            return;
        }

        DB::statement('ALTER TABLE quiz_session_players MODIFY score INT UNSIGNED NOT NULL DEFAULT 0');
        DB::statement('ALTER TABLE quiz_session_answers MODIFY points_awarded INT UNSIGNED NOT NULL DEFAULT 0');
    }
};
