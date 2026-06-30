<?php

namespace App\Services\Mcp\Tools;

use App\Models\User;
use App\Services\ApplicationApiClient;
use App\Services\Mcp\McpJsonSchema;
use App\Services\Mcp\McpTool;
use App\Support\McpUserAccess;
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

    public function descriptionForUser(User $user): string
    {
        if (McpUserAccess::canRead($user) && ! McpUserAccess::canWrite($user)) {
            return 'List read-only API endpoints (GET) that a connected system exposes right now. '
                .'Use the results with call_application_api. Fetched live, not cached.';
        }

        if (McpUserAccess::canWrite($user) && ! McpUserAccess::canRead($user)) {
            return 'List write API endpoints (POST, PUT, PATCH, DELETE) that a connected system exposes right now. '
                .'Use the results with call_application_api. Fetched live, not cached.';
        }

        return $this->description();
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

        $endpoints = $this->client->parseCatalogEndpoints($response->json());
        $endpoints = McpUserAccess::filterCatalogEndpoints($user, $endpoints);

        return ['slug' => $slug, 'endpoints' => $endpoints];
    }
}
