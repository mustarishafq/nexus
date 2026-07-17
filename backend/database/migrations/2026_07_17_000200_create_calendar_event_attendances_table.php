<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('calendar_event_attendances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('calendar_event_id')->constrained('calendar_events')->cascadeOnDelete();
            $table->string('email');
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('display_name')->nullable();
            $table->string('source', 32);
            $table->timestamp('checked_in_at');
            $table->timestamps();

            $table->unique(['calendar_event_id', 'email']);
            $table->index(['calendar_event_id', 'checked_in_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('calendar_event_attendances');
    }
};
