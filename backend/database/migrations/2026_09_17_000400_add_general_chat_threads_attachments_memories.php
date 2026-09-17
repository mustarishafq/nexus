<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('general_chat_conversations', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
        });

        Schema::table('general_chat_conversations', function (Blueprint $table) {
            $table->dropUnique(['user_id']);
            $table->string('title', 120)->nullable()->after('user_id');
            $table->timestamp('pinned_at')->nullable()->after('title');
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->index(['user_id', 'pinned_at', 'last_message_at'], 'general_chat_conversations_user_list_index');
        });

        Schema::table('general_chat_messages', function (Blueprint $table) {
            $table->json('attachments')->nullable()->after('content');
        });

        Schema::create('general_chat_memories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('body', 500);
            $table->timestamps();

            $table->index(['user_id', 'updated_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('general_chat_memories');

        Schema::table('general_chat_messages', function (Blueprint $table) {
            $table->dropColumn('attachments');
        });

        Schema::table('general_chat_conversations', function (Blueprint $table) {
            $table->dropIndex('general_chat_conversations_user_list_index');
            $table->dropForeign(['user_id']);
            $table->dropColumn(['title', 'pinned_at']);
            $table->unique('user_id');
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }
};
