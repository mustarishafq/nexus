<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('network_health_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('latency_ms')->nullable();
            $table->decimal('download_mbps', 8, 2)->nullable();
            $table->decimal('upload_mbps', 8, 2)->nullable();
            $table->string('browser', 64)->nullable();
            $table->string('browser_version', 32)->nullable();
            $table->string('operating_system', 64)->nullable();
            $table->string('device_type', 32)->nullable();
            $table->string('screen_resolution', 32)->nullable();
            $table->string('timezone', 64)->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamp('tested_at');
            $table->timestamps();

            $table->index('user_id');
            $table->index('tested_at');
            $table->index(['user_id', 'tested_at']);
            $table->index('browser');
            $table->index('operating_system');
            $table->index('latency_ms');
            $table->index('download_mbps');
            $table->index('upload_mbps');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('network_health_logs');
    }
};
