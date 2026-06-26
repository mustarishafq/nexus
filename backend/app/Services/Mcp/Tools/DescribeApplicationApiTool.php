<?php

namespace App\Services\Mcp\Tools;

use App\Models\Application;
use App\Models\User;
use App\Services\ApplicationApiClient;
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
        return [
            'type' => 'object',
            'properties' => [
                'slug' => ['type' => 'string', 'description' => 'Application slug from list_applications.'],
            ],
            'required' => ['slug'],
        ];
    }

    public function call(User $user, array $arguments): array
    {
        $slug = (string) ($arguments['slug'] ?? '');

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
