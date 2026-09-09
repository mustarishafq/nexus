<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('llm_usage_logs', function (Blueprint $table) {
            $table->longText('input_text')->nullable()->after('error_message');
            $table->longText('output_text')->nullable()->after('input_text');
        });
    }

    public function down(): void
    {
        Schema::table('llm_usage_logs', function (Blueprint $table) {
            $table->dropColumn(['input_text', 'output_text']);
        });
    }
};
