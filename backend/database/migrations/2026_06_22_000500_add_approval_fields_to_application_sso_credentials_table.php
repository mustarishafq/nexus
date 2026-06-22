<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('application_sso_credentials', function (Blueprint $table) {
            $table->string('status', 20)->default('pending')->after('label');
            $table->foreignId('reviewed_by_user_id')->nullable()->after('status')->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable()->after('reviewed_by_user_id');

            $table->index('status');
        });

        DB::table('application_sso_credentials')->update(['status' => 'approved']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('application_sso_credentials', function (Blueprint $table) {
            $table->dropForeign(['reviewed_by_user_id']);
            $table->dropIndex(['status']);
            $table->dropColumn(['status', 'reviewed_by_user_id', 'reviewed_at']);
        });
    }
};
