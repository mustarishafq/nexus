<?php

use App\Support\McpUserAccess;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $oauthUserIds = DB::table('auth_tokens')
            ->whereNotNull('oauth_client_id')
            ->distinct()
            ->pluck('user_id');

        DB::table('users')
            ->where('mcp_access', McpUserAccess::BOTH)
            ->whereIn('id', $oauthUserIds)
            ->update(['mcp_access' => McpUserAccess::READ]);

        DB::table('users')
            ->where('mcp_access', McpUserAccess::BOTH)
            ->update(['mcp_access' => McpUserAccess::NONE]);
    }

    public function down(): void
    {
        // Legacy blanket grant cannot be restored reliably.
    }
};
