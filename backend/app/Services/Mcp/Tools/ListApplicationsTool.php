<?php

namespace App\Services\Mcp\Tools;

use App\Models\Application;
use App\Models\User;
use App\Services\Mcp\McpJsonSchema;
use App\Services\Mcp\McpTool;
use App\Support\McpUserAccess;
use App\Support\UserApplicationAccess;

class ListApplicationsTool implements McpTool
{
    public function name(): string
    {
        return 'list_applications';
    }

    public function description(): string
    {
        return 'List systems connected to Nexus via SSO that this MCP server can call on your behalf.';
    }

    public function inputSchema(): array
    {
        return McpJsonSchema::object();
    }

    public function call(User $user, array $arguments): array
    {
        $applications = UserApplicationAccess::accessibleMcpApplicationsQuery($user)
            ->get(['id', 'name', 'slug', 'description', 'status', 'environment']);

        return [
            'applications' => $applications
                ->filter(fn (Application $application) => McpUserAccess::canUseMcpForApplication($user, $application))
                ->map(fn (Application $application) => [
                'id' => $application->id,
                'name' => $application->name,
                'slug' => $application->slug,
                'description' => $application->description,
                'status' => $application->status,
                'environment' => $application->environment,
            ])->values()->all(),
        ];
    }
}
