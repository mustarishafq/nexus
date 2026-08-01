<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_streaks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('streak_key', 64);
            $table->unsignedInteger('current_count')->default(0);
            $table->unsignedInteger('longest_count')->default(0);
            $table->date('last_qualified_on')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'streak_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_streaks');
    }
};
