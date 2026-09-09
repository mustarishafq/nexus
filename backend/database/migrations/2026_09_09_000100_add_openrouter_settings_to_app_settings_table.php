<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('app_settings')) {
            return;
        }

        Schema::table('app_settings', function (Blueprint $table) {
            if (! Schema::hasColumn('app_settings', 'openrouter_api_key')) {
                $table->text('openrouter_api_key')->nullable();
            }

            if (! Schema::hasColumn('app_settings', 'openrouter_model')) {
                $table->string('openrouter_model')->nullable();
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('app_settings')) {
            return;
        }

        Schema::table('app_settings', function (Blueprint $table) {
            if (Schema::hasColumn('app_settings', 'openrouter_api_key')) {
                $table->dropColumn('openrouter_api_key');
            }

            if (Schema::hasColumn('app_settings', 'openrouter_model')) {
                $table->dropColumn('openrouter_model');
            }
        });
    }
};
