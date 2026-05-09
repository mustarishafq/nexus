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
        if (! Schema::hasTable('app_settings')) {
            return;
        }

        Schema::table('app_settings', function (Blueprint $table) {
            if (! Schema::hasColumn('app_settings', 'smtp_host')) {
                $table->string('smtp_host')->nullable();
            }

            if (! Schema::hasColumn('app_settings', 'smtp_port')) {
                $table->unsignedInteger('smtp_port')->nullable();
            }

            if (! Schema::hasColumn('app_settings', 'smtp_username')) {
                $table->string('smtp_username')->nullable();
            }

            if (! Schema::hasColumn('app_settings', 'smtp_password')) {
                $table->text('smtp_password')->nullable();
            }

            if (! Schema::hasColumn('app_settings', 'smtp_encryption')) {
                $table->string('smtp_encryption')->nullable();
            }

            if (! Schema::hasColumn('app_settings', 'smtp_from_email')) {
                $table->string('smtp_from_email')->nullable();
            }

            if (! Schema::hasColumn('app_settings', 'smtp_from_name')) {
                $table->string('smtp_from_name')->nullable();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No-op: this migration only backfills missing columns on legacy schemas.
    }
};
