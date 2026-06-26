<?php

namespace App\Services\Mcp\Tools;

use App\Models\User;
use App\Services\ApplicationApiClient;
use App\Services\Mcp\McpJsonSchema;
use App\Services\Mcp\McpTool;
use App\Support\UserApplicationAccess;

class CallApplicationApiTool implements McpTool
{
    public function __construct(private ApplicationApiClient $client) {}

    public function name(): string
    {
        return 'call_application_api';
    }

    public function description(): string
    {
        return 'Call a connected system\'s API using the SSO-linked credentials Nexus already holds for it. '
            .'Use list_applications first to find the right "slug".';
    }

    public function inputSchema(): array
    {
        return McpJsonSchema::object(
            properties: [
                'slug' => ['type' => 'string', 'description' => 'Application slug from list_applications.'],
                'method' => ['type' => 'string', 'enum' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], 'default' => 'GET'],
                'path' => ['type' => 'string', 'description' => 'Path relative to the application\'s base_url, e.g. /api/leads/123.'],
                'query' => McpJsonSchema::openObject('Query string parameters for GET requests.'),
                'body' => McpJsonSchema::openObject('JSON body for POST/PUT/PATCH requests.'),
            ],
            required: ['slug', 'path'],
        );
    }

    public function call(User $user, array $arguments): array
    {
        $slug = (string) ($arguments['slug'] ?? '');
        $method = strtoupper((string) ($arguments['method'] ?? 'GET'));
        $path = (string) ($arguments['path'] ?? '');

        $application = UserApplicationAccess::findMcpApplicationForUser($user, $slug);

        $options = [];
        if (! empty($arguments['query'])) {
            $options['query'] = $arguments['query'];
        }
        if (! empty($arguments['body'])) {
            $options['json'] = $arguments['body'];
        }

        $response = $this->client->request($application, $method, $path, $options);

        return [
            'status' => $response->status(),
            'body' => $response->json() ?? $response->body(),
        ];
    }
}
