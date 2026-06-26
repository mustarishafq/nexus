<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('auth_tokens', function (Blueprint $table) {
            $table->string('label')->nullable()->after('token_hash');
        });
    }

    public function down(): void
    {
        Schema::table('auth_tokens', function (Blueprint $table) {
            $table->dropColumn('label');
        });
    }
};
