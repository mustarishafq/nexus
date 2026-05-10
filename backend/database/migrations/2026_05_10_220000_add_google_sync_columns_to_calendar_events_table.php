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
        Schema::table('calendar_events', function (Blueprint $table) {
            $table->string('google_event_id')->nullable()->after('google_calendar_url');
            $table->enum('google_sync_status', ['pending', 'synced', 'failed'])->default('pending')->after('google_event_id');
            $table->text('google_sync_error')->nullable()->after('google_sync_status');

            $table->index('google_event_id');
            $table->index('google_sync_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('calendar_events', function (Blueprint $table) {
            $table->dropIndex(['google_event_id']);
            $table->dropIndex(['google_sync_status']);

            $table->dropColumn(['google_event_id', 'google_sync_status', 'google_sync_error']);
        });
    }
};
