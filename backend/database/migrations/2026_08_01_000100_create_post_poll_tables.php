<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('post_polls', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique('post_id');
        });

        Schema::create('post_poll_options', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_poll_id')->constrained('post_polls')->cascadeOnDelete();
            $table->string('label', 120);
            $table->unsignedTinyInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['post_poll_id', 'sort_order']);
        });

        Schema::create('post_poll_votes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_poll_id')->constrained('post_polls')->cascadeOnDelete();
            $table->foreignId('post_poll_option_id')->constrained('post_poll_options')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['post_poll_id', 'user_id']);
            $table->index(['post_poll_option_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('post_poll_votes');
        Schema::dropIfExists('post_poll_options');
        Schema::dropIfExists('post_polls');
    }
};
