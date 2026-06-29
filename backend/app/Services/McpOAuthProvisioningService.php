<?php

namespace App\Services;

use App\Models\User;
use App\Support\McpUserAccess;

class McpOAuthProvisioningService
{
    /**
     * When a user approves an MCP OAuth connection, grant read-only MCP
     * access if they do not already have any MCP permissions configured.
     */
    public function provisionOnConsent(User $user): bool
    {
        if ($user->role === 'admin') {
            return false;
        }

        $current = (string) ($user->mcp_access ?? McpUserAccess::NONE);

        if ($current !== McpUserAccess::NONE) {
            return false;
        }

        $user->forceFill(['mcp_access' => McpUserAccess::READ])->save();

        return true;
    }
}
