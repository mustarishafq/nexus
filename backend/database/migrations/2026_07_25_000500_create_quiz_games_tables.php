<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quizzes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('status', 20)->default('draft'); // draft|published
            $table->timestamps();

            $table->index(['user_id', 'status']);
        });

        Schema::create('quiz_questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quiz_id')->constrained()->cascadeOnDelete();
            $table->text('prompt');
            $table->unsignedSmallInteger('time_limit_seconds')->default(20);
            $table->unsignedInteger('points_base')->default(1000);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['quiz_id', 'sort_order']);
        });

        Schema::create('quiz_options', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quiz_question_id')->constrained()->cascadeOnDelete();
            $table->string('label');
            $table->boolean('is_correct')->default(false);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['quiz_question_id', 'sort_order']);
        });

        Schema::create('quiz_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quiz_id')->constrained()->cascadeOnDelete();
            $table->foreignId('host_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('mode', 20)->default('live'); // live|async
            $table->string('pin', 6)->nullable();
            $table->string('join_token', 64)->unique();
            $table->string('status', 20)->default('lobby'); // lobby|question|reveal|leaderboard|finished
            $table->foreignId('current_question_id')->nullable()->constrained('quiz_questions')->nullOnDelete();
            $table->timestamp('question_started_at')->nullable();
            $table->boolean('music_enabled')->default(true);
            $table->timestamps();

            $table->index(['pin', 'status']);
            $table->index(['quiz_id', 'mode', 'status']);
        });

        Schema::create('quiz_session_players', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quiz_session_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('display_name');
            $table->unsignedInteger('score')->default(0);
            $table->unsignedInteger('streak')->default(0);
            $table->timestamp('joined_at')->useCurrent();
            $table->timestamps();

            $table->unique(['quiz_session_id', 'user_id']);
        });

        Schema::create('quiz_session_answers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quiz_session_id')->constrained()->cascadeOnDelete();
            $table->foreignId('quiz_question_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('quiz_option_id')->nullable()->constrained()->nullOnDelete();
            $table->boolean('is_correct')->default(false);
            $table->unsignedInteger('points_awarded')->default(0);
            $table->unsignedInteger('streak_after')->default(0);
            $table->string('power_up_used', 30)->nullable();
            $table->timestamp('answered_at')->nullable();
            $table->unsignedInteger('response_ms')->nullable();
            $table->timestamps();

            $table->unique(['quiz_session_id', 'quiz_question_id', 'user_id'], 'quiz_session_answers_unique');
        });

        Schema::create('quiz_session_power_ups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quiz_session_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type', 30); // eraser|double|streak_freeze
            $table->unsignedTinyInteger('uses_remaining')->default(0);
            $table->foreignId('active_until_question_id')->nullable()->constrained('quiz_questions')->nullOnDelete();
            $table->timestamps();

            $table->unique(['quiz_session_id', 'user_id', 'type'], 'quiz_session_power_ups_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quiz_session_power_ups');
        Schema::dropIfExists('quiz_session_answers');
        Schema::dropIfExists('quiz_session_players');
        Schema::dropIfExists('quiz_sessions');
        Schema::dropIfExists('quiz_options');
        Schema::dropIfExists('quiz_questions');
        Schema::dropIfExists('quizzes');
    }
};
