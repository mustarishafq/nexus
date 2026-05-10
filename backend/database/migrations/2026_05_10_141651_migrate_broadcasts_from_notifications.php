<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Copy broadcasts from notifications table to broadcasts table
        $broadcasts = DB::table('notifications')
            ->where('is_broadcast', true)
            ->get();

        foreach ($broadcasts as $broadcast) {
            DB::table('broadcasts')->insert([
                'title' => $broadcast->title,
                'message' => $broadcast->message,
                'priority' => $broadcast->priority ?? 'medium',
                'broadcast_starts_at' => $broadcast->broadcast_starts_at,
                'broadcast_ends_at' => $broadcast->broadcast_ends_at,
                'created_at' => $broadcast->created_at,
                'updated_at' => $broadcast->updated_at,
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Clear the broadcasts table on rollback
        DB::table('broadcasts')->truncate();
    }
};

