<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->string('mcp_catalog_path')->nullable()->after('calendar_config');
            $table->string('mcp_api_key')->nullable()->after('mcp_catalog_path');
        });
    }

    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropColumn(['mcp_catalog_path', 'mcp_api_key']);
        });
    }
};
