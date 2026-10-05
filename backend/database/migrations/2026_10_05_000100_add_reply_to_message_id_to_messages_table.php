<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            // Quoted reply target. Messages are tombstoned rather than hard
            // deleted, so the quote normally survives; nullOnDelete covers
            // conversation deletes / cleanup.
            $table->foreignId('reply_to_message_id')
                ->nullable()
                ->after('sender_user_id')
                ->constrained('messages')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->dropConstrainedForeignId('reply_to_message_id');
        });
    }
};
