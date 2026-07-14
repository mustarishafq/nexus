<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('profile_media_reactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('owner_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('media_type', 16);
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('reaction', 16);
            $table->timestamps();

            $table->unique(['owner_user_id', 'media_type', 'user_id'], 'profile_media_reactions_unique');
            $table->index(['owner_user_id', 'media_type'], 'profile_media_reactions_lookup');
        });

        Schema::create('profile_media_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('owner_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('media_type', 16);
            $table->foreignId('author_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('parent_comment_id')
                ->nullable()
                ->constrained('profile_media_comments')
                ->cascadeOnDelete();
            $table->string('body', 1000);
            $table->timestamps();

            $table->index(['owner_user_id', 'media_type', 'created_at'], 'profile_media_comments_lookup');
        });

        Schema::create('profile_media_comment_reactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('profile_media_comment_id')
                ->constrained('profile_media_comments')
                ->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('reaction', 16);
            $table->timestamps();

            $table->unique(['profile_media_comment_id', 'user_id'], 'profile_media_comment_reactions_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('profile_media_comment_reactions');
        Schema::dropIfExists('profile_media_comments');
        Schema::dropIfExists('profile_media_reactions');
    }
};
