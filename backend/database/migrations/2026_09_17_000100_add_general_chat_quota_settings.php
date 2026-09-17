<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('app_settings', function (Blueprint $table) {
            $table->unsignedInteger('general_chat_token_limit')->default(100000);
            $table->string('general_chat_reset_period', 16)->default('monthly');
            $table->string('general_chat_reset_time', 5)->default('00:00');
            $table->unsignedTinyInteger('general_chat_reset_weekday')->default(1);
            $table->unsignedTinyInteger('general_chat_reset_month_day')->default(1);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->unsignedInteger('general_chat_token_limit')->nullable()->after('assistant_access');
        });
    }

    public function down(): void
    {
        Schema::table('app_settings', function (Blueprint $table) {
            $table->dropColumn([
                'general_chat_token_limit',
                'general_chat_reset_period',
                'general_chat_reset_time',
                'general_chat_reset_weekday',
                'general_chat_reset_month_day',
            ]);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('general_chat_token_limit');
        });
    }
};
