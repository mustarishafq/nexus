<?php

namespace App\Services\Mcp\Tools;

use App\Models\User;
use App\Services\ApplicationApiClient;
use App\Services\Mcp\McpJsonSchema;
use App\Services\Mcp\McpTool;
use App\Support\UserApplicationAccess;

class DescribeApplicationApiTool implements McpTool
{
    public function __construct(private ApplicationApiClient $client) {}

    public function name(): string
    {
        return 'describe_application_api';
    }

    public function description(): string
    {
        return 'List the API endpoints (method, path, params, description) a connected system exposes right now, '
            .'so you know what to pass to call_application_api. Fetched live from the system itself, not cached.';
    }

    public function inputSchema(): array
    {
        return McpJsonSchema::object(
            properties: [
                'slug' => ['type' => 'string', 'description' => 'Application slug from list_applications.'],
            ],
            required: ['slug'],
        );
    }

    public function call(User $user, array $arguments): array
    {
        $slug = (string) ($arguments['slug'] ?? '');
        $application = UserApplicationAccess::findMcpApplicationForUser($user, $slug);
        $path = $this->client->catalogPath($application);
        $response = $this->client->request($application, 'GET', $path);

        if ($response->failed()) {
            return [
                'slug' => $slug,
                'endpoints' => [],
                'note' => "Could not fetch catalog from {$slug} (HTTP {$response->status()}). "
                    ."It may not expose {$path} yet.",
            ];
        }

        return ['slug' => $slug, 'endpoints' => $response->json() ?? []];
    }
}
