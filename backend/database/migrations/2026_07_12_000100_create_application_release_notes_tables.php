<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('application_release_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('application_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title');
            $table->text('body')->nullable();
            $table->string('version', 64)->nullable();
            $table->string('category', 32)->default('feature');
            $table->boolean('is_published')->default(true);
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->index(['application_id', 'published_at']);
            $table->index(['application_id', 'is_published']);
        });

        Schema::create('user_application_release_note_reads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('release_note_id')->constrained('application_release_notes')->cascadeOnDelete();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'release_note_id'], 'user_release_note_reads_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_application_release_note_reads');
        Schema::dropIfExists('application_release_notes');
    }
};
