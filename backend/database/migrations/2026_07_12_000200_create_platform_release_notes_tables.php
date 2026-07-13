<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('platform_release_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title');
            $table->string('version', 64)->nullable();
            $table->boolean('is_published')->default(true);
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->index(['is_published', 'published_at']);
        });

        Schema::create('platform_release_note_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('release_note_id')->constrained('platform_release_notes')->cascadeOnDelete();
            $table->string('category', 32)->default('feature');
            $table->text('body');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['release_note_id', 'sort_order']);
        });

        Schema::create('user_platform_release_note_reads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('release_note_id')->constrained('platform_release_notes')->cascadeOnDelete();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'release_note_id'], 'user_platform_release_note_reads_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_platform_release_note_reads');
        Schema::dropIfExists('platform_release_note_items');
        Schema::dropIfExists('platform_release_notes');
    }
};
