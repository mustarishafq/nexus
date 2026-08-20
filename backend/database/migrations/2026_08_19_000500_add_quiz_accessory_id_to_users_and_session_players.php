<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'quiz_accessory_id')) {
                $table->string('quiz_accessory_id', 64)->nullable()->after('profile_picture_crop');
            }
        });

        Schema::table('quiz_session_players', function (Blueprint $table) {
            if (! Schema::hasColumn('quiz_session_players', 'quiz_accessory_id')) {
                $table->string('quiz_accessory_id', 64)->nullable()->after('display_name');
            }
            if (! Schema::hasColumn('quiz_session_players', 'profile_picture')) {
                $table->string('profile_picture', 2048)->nullable()->after('quiz_accessory_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'quiz_accessory_id')) {
                $table->dropColumn('quiz_accessory_id');
            }
        });

        Schema::table('quiz_session_players', function (Blueprint $table) {
            if (Schema::hasColumn('quiz_session_players', 'quiz_accessory_id')) {
                $table->dropColumn('quiz_accessory_id');
            }
            if (Schema::hasColumn('quiz_session_players', 'profile_picture')) {
                $table->dropColumn('profile_picture');
            }
        });
    }
};
