<?php

namespace App\Services\Mcp\Tools;

use App\Models\Application;
use App\Models\User;
use App\Services\Mcp\McpTool;
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
        return [
            'type' => 'object',
            'properties' => (object) [],
        ];
    }

    public function call(User $user, array $arguments): array
    {
        $query = Application::query()
            ->where('is_enabled', true)
            ->where('mcp_enabled', true)
            ->with('privateAccessEmails');

        if ($user->role !== 'admin') {
            $allowedPublicSlugs = UserApplicationAccess::allowedPublicSlugs($user);

            $query->where(function ($systems) use ($user, $allowedPublicSlugs) {
                $systems->where(function ($publicSystems) use ($allowedPublicSlugs) {
                    $publicSystems->where('visibility', 'public');
                    if ($allowedPublicSlugs !== null) {
                        if (count($allowedPublicSlugs) === 0) {
                            $publicSystems->whereRaw('1 = 0');
                        } else {
                            $publicSystems->whereIn('slug', $allowedPublicSlugs);
                        }
                    }
                })->orWhere(function ($privateSystems) use ($user) {
                    $privateSystems
                        ->where('visibility', 'private')
                        ->where(function ($privateAccess) use ($user) {
                            $privateAccess
                                ->where('created_by_user_id', $user->id)
                                ->orWhereHas('privateAccessEmails', fn ($emailQuery) => $emailQuery->where('email', $user->email));
                        });
                });
            });
        }

        $applications = $query->get(['id', 'name', 'slug', 'description', 'status', 'environment', 'visibility', 'created_by_user_id']);

        $result = $applications->map(fn (Application $application) => [
            'id' => $application->id,
            'name' => $application->name,
            'slug' => $application->slug,
            'description' => $application->description,
            'status' => $application->status,
            'environment' => $application->environment,
        ]);

        return ['applications' => $result->values()->toArray()];
    }
}
