<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('quiz_sessions', 'phase_ends_at')) {
            Schema::table('quiz_sessions', function (Blueprint $table) {
                $after = Schema::hasColumn('quiz_sessions', 'question_ends_at')
                    ? 'question_ends_at'
                    : 'question_started_at';
                $table->timestamp('phase_ends_at')->nullable()->after($after);
            });
        }
    }

    public function down(): void
    {
        Schema::table('quiz_sessions', function (Blueprint $table) {
            $table->dropColumn('phase_ends_at');
        });
    }
};
