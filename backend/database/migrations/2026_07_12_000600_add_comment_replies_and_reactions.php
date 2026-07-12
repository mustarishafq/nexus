<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('post_comments', function (Blueprint $table) {
            $table->foreignId('parent_comment_id')
                ->nullable()
                ->after('post_id')
                ->constrained('post_comments')
                ->cascadeOnDelete();
        });

        Schema::create('post_comment_reactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_comment_id')->constrained('post_comments')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('reaction', 16);
            $table->timestamps();

            $table->unique(['post_comment_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('post_comment_reactions');

        Schema::table('post_comments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('parent_comment_id');
        });
    }
};
