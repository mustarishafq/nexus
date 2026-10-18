<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assistant_messages', function (Blueprint $table) {
            $table->json('attachments')->nullable()->after('content');
            $table->json('visuals')->nullable()->after('attachments');
        });

        Schema::table('general_chat_messages', function (Blueprint $table) {
            $table->json('visuals')->nullable()->after('attachments');
        });
    }

    public function down(): void
    {
        Schema::table('assistant_messages', function (Blueprint $table) {
            $table->dropColumn(['attachments', 'visuals']);
        });

        Schema::table('general_chat_messages', function (Blueprint $table) {
            $table->dropColumn('visuals');
        });
    }
};
