<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('auth_tokens', function (Blueprint $table) {
            $table->string('oauth_client_id', 64)->nullable()->after('user_id');
        });
    }

    public function down(): void
    {
        Schema::table('auth_tokens', function (Blueprint $table) {
            $table->dropColumn('oauth_client_id');
        });
    }
};
