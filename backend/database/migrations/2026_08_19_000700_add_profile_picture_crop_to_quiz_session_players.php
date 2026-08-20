<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quiz_session_players', function (Blueprint $table) {
            if (! Schema::hasColumn('quiz_session_players', 'profile_picture_crop')) {
                $table->json('profile_picture_crop')->nullable()->after('profile_picture');
            }
        });
    }

    public function down(): void
    {
        Schema::table('quiz_session_players', function (Blueprint $table) {
            if (Schema::hasColumn('quiz_session_players', 'profile_picture_crop')) {
                $table->dropColumn('profile_picture_crop');
            }
        });
    }
};
