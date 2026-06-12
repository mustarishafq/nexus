<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('metabase_dashboards', function (Blueprint $table) {
            $table->string('assignment_type', 20)->default('group')->after('public_url');
            $table->json('user_ids')->nullable()->after('access_group_ids');
            $table->foreignId('owner_user_id')->nullable()->after('user_ids')->constrained('users')->nullOnDelete();
            $table->string('category')->nullable()->after('owner_user_id');

            $table->index('assignment_type');
            $table->index('category');
            $table->index('owner_user_id');
        });
    }

    public function down(): void
    {
        Schema::table('metabase_dashboards', function (Blueprint $table) {
            $table->dropForeign(['owner_user_id']);
            $table->dropIndex(['assignment_type']);
            $table->dropIndex(['category']);
            $table->dropIndex(['owner_user_id']);
            $table->dropColumn(['assignment_type', 'user_ids', 'owner_user_id', 'category']);
        });
    }
};
