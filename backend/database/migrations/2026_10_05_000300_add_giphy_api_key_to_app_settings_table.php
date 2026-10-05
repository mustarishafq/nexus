<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('app_settings') || Schema::hasColumn('app_settings', 'giphy_api_key')) {
            return;
        }

        Schema::table('app_settings', function (Blueprint $table) {
            // GIF search in feed comments; overrides GIPHY_API_KEY when set.
            $table->text('giphy_api_key')->nullable();
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('app_settings') && Schema::hasColumn('app_settings', 'giphy_api_key')) {
            Schema::table('app_settings', function (Blueprint $table) {
                $table->dropColumn('giphy_api_key');
            });
        }
    }
};
