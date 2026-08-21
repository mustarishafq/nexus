<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quizzes', function (Blueprint $table) {
            if (! Schema::hasColumn('quizzes', 'async_deadline_at')) {
                $table->timestamp('async_deadline_at')->nullable()->after('async_power_ups_enabled');
            }
        });
    }

    public function down(): void
    {
        Schema::table('quizzes', function (Blueprint $table) {
            if (Schema::hasColumn('quizzes', 'async_deadline_at')) {
                $table->dropColumn('async_deadline_at');
            }
        });
    }
};
