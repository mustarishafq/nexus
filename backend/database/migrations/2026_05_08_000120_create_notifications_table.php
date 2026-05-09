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
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->string('user_id')->nullable();
            $table->string('system_id')->nullable();
            $table->enum('type', ['info', 'success', 'warning', 'error', 'critical'])->default('info');
            $table->enum('priority', ['low', 'medium', 'high', 'critical'])->default('medium');
            $table->string('title');
            $table->text('message')->nullable();
            $table->json('data')->nullable();
            $table->enum('category', ['booking', 'hr', 'inventory', 'finance', 'security', 'system', 'task', 'approval', 'announcement', 'other'])->default('other');
            $table->boolean('is_read')->default(false);
            $table->timestamp('read_at')->nullable();
            $table->boolean('is_broadcast')->default(false);
            $table->timestamp('snoozed_until')->nullable();
            $table->string('action_url')->nullable();
            $table->json('delivery_channels')->nullable();
            $table->timestamps();

            $table->index('user_id');
            $table->index('system_id');
            $table->index('type');
            $table->index('priority');
            $table->index('category');
            $table->index('is_read');
            $table->index('is_broadcast');
            $table->index('snoozed_until');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
