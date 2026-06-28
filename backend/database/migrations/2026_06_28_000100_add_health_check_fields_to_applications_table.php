<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->boolean('health_check_enabled')->default(true)->after('last_heartbeat');
            $table->string('health_check_path', 255)->default('/api/health')->after('health_check_enabled');
            $table->enum('health_check_mode', ['json_ok', 'http_status'])->default('json_ok')->after('health_check_path');
        });
    }

    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropColumn(['health_check_enabled', 'health_check_path', 'health_check_mode']);
        });
    }
};
