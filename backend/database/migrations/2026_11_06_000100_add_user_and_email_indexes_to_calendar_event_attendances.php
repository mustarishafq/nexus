<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('calendar_event_attendances', function (Blueprint $table) {
            $table->index(['user_id', 'checked_in_at'], 'cea_user_checked_in_idx');
            $table->index('email', 'cea_email_idx');
        });
    }

    public function down(): void
    {
        Schema::table('calendar_event_attendances', function (Blueprint $table) {
            $table->dropIndex('cea_user_checked_in_idx');
            $table->dropIndex('cea_email_idx');
        });
    }
};

