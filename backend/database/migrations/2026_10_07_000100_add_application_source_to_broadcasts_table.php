<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Broadcasts an application raises for one of its own records (e.g. an Insan
 * letter waiting to be signed). The application names the record by its own
 * reference, links back to it, and resolves the broadcast when the record is
 * done with — until then it stays active.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('broadcasts', function (Blueprint $table) {
            $table->foreignId('application_id')->nullable()->after('audience_type')
                ->constrained('applications')->nullOnDelete();
            $table->string('external_ref', 120)->nullable()->after('application_id');
            $table->string('action_url', 2048)->nullable()->after('message');
            $table->string('action_label', 60)->nullable()->after('action_url');
            $table->dateTime('resolved_at')->nullable()->after('broadcast_ends_at');

            $table->unique(['application_id', 'external_ref']);
        });
    }

    public function down(): void
    {
        Schema::table('broadcasts', function (Blueprint $table) {
            $table->dropUnique(['application_id', 'external_ref']);
            $table->dropConstrainedForeignId('application_id');
            $table->dropColumn(['external_ref', 'action_url', 'action_label', 'resolved_at']);
        });
    }
};
