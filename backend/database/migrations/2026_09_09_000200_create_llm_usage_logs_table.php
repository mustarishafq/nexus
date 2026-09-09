<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('llm_usage_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('provider')->default('openrouter');
            $table->string('model')->nullable();
            $table->string('feature')->default('assistant');
            $table->string('application_slug')->nullable();
            $table->unsignedInteger('prompt_tokens')->default(0);
            $table->unsignedInteger('completion_tokens')->default(0);
            $table->unsignedInteger('total_tokens')->default(0);
            $table->unsignedInteger('reasoning_tokens')->default(0);
            $table->unsignedInteger('cached_tokens')->default(0);
            $table->decimal('cost', 16, 8)->nullable();
            $table->decimal('upstream_cost', 16, 8)->nullable();
            $table->string('generation_id')->nullable();
            $table->unsignedSmallInteger('request_count')->default(1);
            $table->boolean('ok')->default(true);
            $table->string('error_message', 500)->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['created_at']);
            $table->index(['user_id', 'created_at']);
            $table->index(['model', 'created_at']);
            $table->index(['feature', 'created_at']);
            $table->index(['application_slug', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('llm_usage_logs');
    }
};
