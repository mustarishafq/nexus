<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $duplicateGroups = DB::table('auth_tokens')
            ->select('user_id', 'oauth_client_id')
            ->whereNotNull('oauth_client_id')
            ->groupBy('user_id', 'oauth_client_id')
            ->havingRaw('COUNT(*) > 1')
            ->get();

        foreach ($duplicateGroups as $group) {
            $keepId = DB::table('auth_tokens')
                ->where('user_id', $group->user_id)
                ->where('oauth_client_id', $group->oauth_client_id)
                ->orderByDesc('last_used_at')
                ->orderByDesc('created_at')
                ->value('id');

            if ($keepId === null) {
                continue;
            }

            DB::table('auth_tokens')
                ->where('user_id', $group->user_id)
                ->where('oauth_client_id', $group->oauth_client_id)
                ->where('id', '!=', $keepId)
                ->delete();
        }
    }

    public function down(): void
    {
        // Deleted duplicate rows cannot be restored.
    }
};
