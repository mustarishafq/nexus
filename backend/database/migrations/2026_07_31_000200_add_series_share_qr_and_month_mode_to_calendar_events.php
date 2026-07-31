<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('calendar_events', function (Blueprint $table) {
            $table->dropUnique(['check_in_token']);
            $table->index('check_in_token');

            $table->boolean('series_share_qr')->default(false)->after('series_index');
            $table->string('recurrence_month_mode', 32)->nullable()->after('series_share_qr');
            $table->unsignedTinyInteger('recurrence_month_day')->nullable()->after('recurrence_month_mode');
        });
    }

    public function down(): void
    {
        Schema::table('calendar_events', function (Blueprint $table) {
            $table->dropColumn(['series_share_qr', 'recurrence_month_mode', 'recurrence_month_day']);
            $table->dropIndex(['check_in_token']);
            $table->unique('check_in_token');
        });
    }
};
