<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('connected_systems', function (Blueprint $table) {
            $table->json('private_allowed_user_emails')->nullable()->after('created_by_user_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('connected_systems', function (Blueprint $table) {
            $table->dropColumn('private_allowed_user_emails');
        });
    }
};
