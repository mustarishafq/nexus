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

        return $this->description().' Allowed methods depend on the target application slug.';
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

        if (self::supportsRequestBody($methods)) {
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

        $body = self::normalizeRequestBody($arguments['body'] ?? null);
        if ($body !== null) {
            $options['json'] = $body;
        }

        $response = $this->client->request($application, $method, $path, $options);

        return [
            'status' => $response->status(),
            'body' => $response->json() ?? $response->body(),
        ];
    }

    /**
     * @param  list<string>  $methods
     */
    private static function supportsRequestBody(array $methods): bool
    {
        return array_intersect($methods, ['POST', 'PUT', 'PATCH', 'DELETE']) !== [];
    }

    /**
     * MCP clients sometimes pass JSON bodies as strings; Laravel's HTTP client
     * must receive an array/object or it forwards a quoted JSON string instead.
     *
     * @return array<string, mixed>|list<mixed>|null
     */
    private static function normalizeRequestBody(mixed $body): ?array
    {
        if ($body === null || $body === '') {
            return null;
        }

        if (is_string($body)) {
            $decoded = json_decode($body, true);

            return is_array($decoded) ? $decoded : null;
        }

        if (is_array($body)) {
            return $body;
        }

        if (is_object($body)) {
            return (array) $body;
        }

        return null;
    }
}
