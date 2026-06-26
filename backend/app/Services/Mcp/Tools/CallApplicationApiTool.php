<?php

namespace App\Services\Mcp\Tools;

use App\Models\Application;
use App\Models\User;
use App\Services\ApplicationApiClient;
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
        return [
            'type' => 'object',
            'properties' => [
                'slug' => ['type' => 'string', 'description' => 'Application slug from list_applications.'],
                'method' => ['type' => 'string', 'enum' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], 'default' => 'GET'],
                'path' => ['type' => 'string', 'description' => 'Path relative to the application\'s base_url, e.g. /api/leads/123.'],
                'query' => [
                    'type' => 'object',
                    'description' => 'Query string parameters for GET requests.',
                    'properties' => (object) [],
                    'additionalProperties' => true,
                ],
                'body' => [
                    'type' => 'object',
                    'description' => 'JSON body for POST/PUT/PATCH requests.',
                    'properties' => (object) [],
                    'additionalProperties' => true,
                ],
            ],
            'required' => ['slug', 'path'],
        ];
    }

    public function call(User $user, array $arguments): array
    {
        $slug = (string) ($arguments['slug'] ?? '');
        $method = strtoupper((string) ($arguments['method'] ?? 'GET'));
        $path = (string) ($arguments['path'] ?? '');

        $application = Application::query()
            ->where('slug', $slug)
            ->where('is_enabled', true)
            ->where('mcp_enabled', true)
            ->with('privateAccessEmails')
            ->first();

        if (! $application) {
            throw new \RuntimeException("No enabled application found for slug \"{$slug}\".");
        }

        if (! $this->userCanAccess($user, $application)) {
            throw new \RuntimeException("You don't have access to \"{$slug}\".");
        }

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

    private function userCanAccess(User $user, Application $application): bool
    {
        if ($user->role === 'admin') {
            return true;
        }

        if ($application->visibility === 'public') {
            $allowedPublicSlugs = UserApplicationAccess::allowedPublicSlugs($user);

            return $allowedPublicSlugs === null || in_array($application->slug, $allowedPublicSlugs, true);
        }

        return $application->created_by_user_id === $user->id
            || $application->privateAccessEmails->contains('email', $user->email);
    }
}
