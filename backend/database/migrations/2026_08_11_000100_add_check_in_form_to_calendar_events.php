<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('calendar_events', function (Blueprint $table) {
            $table->json('check_in_form_fields')->nullable()->after('check_in_opens_at');
            $table->string('check_in_form_audience', 32)->default('public')->after('check_in_form_fields');
        });

        Schema::table('calendar_event_attendances', function (Blueprint $table) {
            $table->json('form_answers')->nullable()->after('display_name');
        });
    }

    public function down(): void
    {
        Schema::table('calendar_events', function (Blueprint $table) {
            $table->dropColumn(['check_in_form_fields', 'check_in_form_audience']);
        });

        Schema::table('calendar_event_attendances', function (Blueprint $table) {
            $table->dropColumn('form_answers');
        });
    }
};
