<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('general_chat_auto_memory')->default(true)->after('general_chat_token_limit');
        });

        Schema::table('general_chat_conversations', function (Blueprint $table) {
            $table->boolean('use_memory')->nullable()->after('pinned_at');
        });
    }

    public function down(): void
    {
        Schema::table('general_chat_conversations', function (Blueprint $table) {
            $table->dropColumn('use_memory');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('general_chat_auto_memory');
        });
    }
};
