<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->json('calendar_config')->nullable()->after('notification_config');
        });

        Schema::table('calendar_events', function (Blueprint $table) {
            $table->string('source_system_id')->nullable()->after('created_by');
            $table->string('external_event_id')->nullable()->after('source_system_id');

            $table->index('source_system_id');
            $table->unique(['source_system_id', 'external_event_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('calendar_events', function (Blueprint $table) {
            $table->dropUnique(['source_system_id', 'external_event_id']);
            $table->dropIndex(['source_system_id']);
            $table->dropColumn(['source_system_id', 'external_event_id']);
        });

        Schema::table('applications', function (Blueprint $table) {
            $table->dropColumn('calendar_config');
        });
    }
};
