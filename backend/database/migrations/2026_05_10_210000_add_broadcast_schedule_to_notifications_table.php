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
        Schema::table('notifications', function (Blueprint $table) {
            $table->timestamp('broadcast_starts_at')->nullable()->after('is_broadcast');
            $table->timestamp('broadcast_ends_at')->nullable()->after('broadcast_starts_at');

            $table->index('broadcast_starts_at');
            $table->index('broadcast_ends_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndex(['broadcast_starts_at']);
            $table->dropIndex(['broadcast_ends_at']);

            $table->dropColumn(['broadcast_starts_at', 'broadcast_ends_at']);
        });
    }
};
