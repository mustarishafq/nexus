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
        Schema::create('system_events', function (Blueprint $table) {
            $table->id();
            $table->string('system_id');
            $table->enum('event_type', ['info', 'warning', 'error', 'critical', 'health_check', 'webhook'])->default('info');
            $table->string('title');
            $table->json('payload')->nullable();
            $table->enum('status', ['pending', 'processed', 'failed', 'acknowledged'])->default('pending');
            $table->unsignedTinyInteger('severity')->nullable();
            $table->timestamps();

            $table->index('system_id');
            $table->index('event_type');
            $table->index('status');
            $table->index('severity');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('system_events');
    }
};
