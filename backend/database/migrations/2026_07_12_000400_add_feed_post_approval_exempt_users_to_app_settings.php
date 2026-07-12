<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('app_settings', function (Blueprint $table) {
            if (! Schema::hasColumn('app_settings', 'feed_post_approval_exempt_user_ids')) {
                $table->json('feed_post_approval_exempt_user_ids')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('app_settings', function (Blueprint $table) {
            if (Schema::hasColumn('app_settings', 'feed_post_approval_exempt_user_ids')) {
                $table->dropColumn('feed_post_approval_exempt_user_ids');
            }
        });
    }
};
