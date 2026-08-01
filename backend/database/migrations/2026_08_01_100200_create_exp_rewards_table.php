<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('exp_rewards', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('action_key', 64);
            $table->unsignedInteger('amount');
            $table->string('title');
            $table->string('status', 16)->default('pending');
            $table->string('source_type', 64);
            $table->string('source_id', 64);
            $table->json('metadata')->nullable();
            $table->timestamp('claimed_at')->nullable();
            $table->timestamps();

            $table->unique(
                ['user_id', 'action_key', 'source_type', 'source_id'],
                'exp_rewards_user_action_source_unique'
            );
            $table->index(['user_id', 'status']);
            $table->index(['status', 'claimed_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('exp_rewards');
    }
};
