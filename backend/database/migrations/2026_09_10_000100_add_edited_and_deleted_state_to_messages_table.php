<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->timestamp('edited_at')->nullable()->after('body');
            // Deliberately a plain timestamp, not Eloquent SoftDeletes: a
            // deleted message must remain visible in the thread as a
            // tombstone ("This message has been deleted"), not be hidden
            // from default queries the way soft-deleted posts are.
            $table->timestamp('deleted_at')->nullable()->after('edited_at');
        });
    }

    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->dropColumn(['edited_at', 'deleted_at']);
        });
    }
};
