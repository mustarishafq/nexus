<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('general_chat_conversations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamp('last_message_at')->nullable();
            $table->timestamps();

            $table->unique('user_id');
        });

        Schema::create('general_chat_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('general_chat_conversation_id')->constrained()->cascadeOnDelete();
            $table->string('role', 32);
            $table->text('content');
            $table->json('usage')->nullable();
            $table->timestamps();

            $table->index(['general_chat_conversation_id', 'created_at'], 'general_chat_messages_conversation_created_index');
        });

        Schema::create('general_chat_token_grants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('tokens');
            $table->timestamp('period_starts_at');
            $table->string('note', 500)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['user_id', 'period_starts_at'], 'general_chat_grants_user_period_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('general_chat_token_grants');
        Schema::dropIfExists('general_chat_messages');
        Schema::dropIfExists('general_chat_conversations');
    }
};
