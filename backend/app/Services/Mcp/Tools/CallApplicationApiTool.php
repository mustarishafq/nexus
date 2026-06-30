<?php

namespace App\Services\Mcp\Tools;

use App\Models\User;
use App\Services\ApplicationApiClient;
use App\Services\Mcp\McpJsonSchema;
use App\Services\Mcp\McpTool;
use App\Support\McpUserAccess;
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

    public function descriptionForUser(User $user): string
    {
        if (McpUserAccess::canRead($user) && ! McpUserAccess::canWrite($user)) {
            return 'Call a connected system\'s API with GET requests only. '
                .'Use describe_application_api to see available read endpoints, then pass slug and path here.';
        }

        if (McpUserAccess::canWrite($user) && ! McpUserAccess::canRead($user)) {
            return 'Call a connected system\'s API with POST, PUT, PATCH, or DELETE requests only. '
                .'Use describe_application_api to see available write endpoints, then pass slug and path here.';
        }

        return $this->description();
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

    public function inputSchemaForUser(User $user): array
    {
        $methods = McpUserAccess::allowedHttpMethods($user);

        $properties = [
            'slug' => ['type' => 'string', 'description' => 'Application slug from list_applications.'],
            'method' => ['type' => 'string', 'enum' => $methods, 'default' => $methods[0] ?? 'GET'],
            'path' => ['type' => 'string', 'description' => 'Path relative to the application\'s base_url, e.g. /api/leads/123.'],
        ];

        if (McpUserAccess::canRead($user)) {
            $properties['query'] = McpJsonSchema::openObject('Query string parameters for GET requests.');
        }

        if (McpUserAccess::canWrite($user)) {
            $properties['body'] = McpJsonSchema::openObject('JSON body for POST/PUT/PATCH requests.');
        }

        return McpJsonSchema::object(
            properties: $properties,
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
