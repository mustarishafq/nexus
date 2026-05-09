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
        Schema::create('connected_systems', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->string('base_url')->nullable();
            $table->string('icon_url')->nullable();
            $table->enum('status', ['online', 'offline', 'maintenance', 'degraded'])->default('online');
            $table->string('api_key')->nullable();
            $table->boolean('is_enabled')->default(true);
            $table->timestamp('last_heartbeat')->nullable();
            $table->json('notification_config')->nullable();
            $table->string('color', 20)->nullable();
            $table->timestamps();

            $table->index('status');
            $table->index('is_enabled');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('connected_systems');
    }
};
