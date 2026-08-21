<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quiz_sessions', function (Blueprint $table) {
            if (! Schema::hasColumn('quiz_sessions', 'is_preview')) {
                $table->boolean('is_preview')->default(false)->after('mode');
            }
        });
    }

    public function down(): void
    {
        Schema::table('quiz_sessions', function (Blueprint $table) {
            if (Schema::hasColumn('quiz_sessions', 'is_preview')) {
                $table->dropColumn('is_preview');
            }
        });
    }
};
