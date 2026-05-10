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
            $table->enum('auth_mode', ['jwt', 'redirect'])->default('jwt')->after('api_key');
            $table->enum('visibility', ['public', 'private'])->default('public')->after('auth_mode');
            $table->foreignId('created_by_user_id')->nullable()->after('visibility')->constrained('users')->nullOnDelete();

            $table->index('auth_mode');
            $table->index('visibility');
            $table->index('created_by_user_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('connected_systems', function (Blueprint $table) {
            $table->dropIndex(['auth_mode']);
            $table->dropIndex(['visibility']);
            $table->dropIndex(['created_by_user_id']);
            $table->dropConstrainedForeignId('created_by_user_id');
            $table->dropColumn(['auth_mode', 'visibility']);
        });
    }
};
