<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('network_health_alerts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('network_health_log_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('alert_type', ['latency', 'download', 'upload']);
            $table->decimal('metric_value', 10, 2);
            $table->decimal('threshold_value', 10, 2);
            $table->enum('status', ['active', 'acknowledged', 'resolved'])->default('active');
            $table->foreignId('acknowledged_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('acknowledged_at')->nullable();
            $table->timestamps();

            $table->index('user_id');
            $table->index('alert_type');
            $table->index('status');
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('network_health_alerts');
    }
};
