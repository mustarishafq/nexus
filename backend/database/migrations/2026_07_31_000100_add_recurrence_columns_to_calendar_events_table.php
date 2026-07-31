<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('calendar_events', function (Blueprint $table) {
            $table->uuid('series_id')->nullable()->after('is_all_day');
            $table->string('recurrence_frequency', 16)->nullable()->after('series_id');
            $table->unsignedInteger('series_index')->nullable()->after('recurrence_frequency');

            $table->index('series_id');
        });
    }

    public function down(): void
    {
        Schema::table('calendar_events', function (Blueprint $table) {
            $table->dropIndex(['series_id']);
            $table->dropColumn(['series_id', 'recurrence_frequency', 'series_index']);
        });
    }
};
