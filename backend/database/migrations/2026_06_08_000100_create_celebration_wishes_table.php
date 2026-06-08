<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('celebration_wishes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('recipient_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('sender_user_id')->constrained('users')->cascadeOnDelete();
            $table->enum('celebration_type', ['birthday', 'service_anniversary']);
            $table->date('celebration_date');
            $table->string('reaction', 16)->default('🎉');
            $table->text('message')->nullable();
            $table->timestamps();

            $table->unique(
                ['recipient_user_id', 'sender_user_id', 'celebration_type', 'celebration_date'],
                'celebration_wishes_unique_per_day'
            );
            $table->index(['celebration_date', 'celebration_type']);
            $table->index('recipient_user_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('celebration_wishes');
    }
};
