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
        Schema::dropIfExists('google_oauth_tokens');

        if (! Schema::hasTable('calendar_events')) {
            return;
        }

        Schema::table('calendar_events', function (Blueprint $table) {
            if (Schema::hasColumn('calendar_events', 'google_event_id')) {
                $table->dropIndex(['google_event_id']);
            }

            if (Schema::hasColumn('calendar_events', 'google_sync_status')) {
                $table->dropIndex(['google_sync_status']);
            }
        });

        $columns = array_values(array_filter([
            'google_calendar_url',
            'google_event_id',
            'google_sync_status',
            'google_sync_error',
        ], fn (string $column) => Schema::hasColumn('calendar_events', $column)));

        if ($columns === []) {
            return;
        }

        Schema::table('calendar_events', function (Blueprint $table) use ($columns) {
            $table->dropColumn($columns);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (! Schema::hasTable('google_oauth_tokens')) {
            Schema::create('google_oauth_tokens', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('user_id');
                $table->string('provider')->default('google');
                $table->text('access_token');
                $table->text('refresh_token')->nullable();
                $table->timestamp('expires_at')->nullable();
                $table->string('token_type')->nullable();
                $table->text('scopes')->nullable();
                $table->timestamps();

                $table->unique(['user_id', 'provider']);
                $table->index('provider');
                $table->index('expires_at');
            });
        }

        Schema::table('calendar_events', function (Blueprint $table) {
            if (! Schema::hasColumn('calendar_events', 'google_calendar_url')) {
                $table->text('google_calendar_url')->nullable();
            }

            if (! Schema::hasColumn('calendar_events', 'google_event_id')) {
                $table->string('google_event_id')->nullable();
                $table->index('google_event_id');
            }

            if (! Schema::hasColumn('calendar_events', 'google_sync_status')) {
                $table->enum('google_sync_status', ['pending', 'synced', 'failed'])->default('pending');
                $table->index('google_sync_status');
            }

            if (! Schema::hasColumn('calendar_events', 'google_sync_error')) {
                $table->text('google_sync_error')->nullable();
            }
        });
    }
};
