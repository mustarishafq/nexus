<?php

namespace App\Console\Commands;

use App\Http\Controllers\Api\McpController;
use App\Models\Application;
use App\Models\User;
use App\Support\ApiTokenAuth;
use Illuminate\Console\Command;
use Illuminate\Http\Request;

class McpTestCommand extends Command
{
    protected $signature = 'mcp:test {--email=} {--call=list_applications} {--slug=} {--path=} {--method=GET}';

    protected $description = 'Smoke-test the Nexus MCP endpoint (initialize, tools/list, tools/call) without needing curl or a running server';

    public function handle(McpController $controller): int
    {
        $user = $this->resolveUser();

        if (! $user) {
            $this->error('No user found to test with. Pass --email=someone@example.com.');

            return self::FAILURE;
        }

        $this->info("Testing as: {$user->email}");

        $token = ApiTokenAuth::issueToken($user);

        try {
            $this->step('initialize', $controller, ['jsonrpc' => '2.0', 'id' => 1, 'method' => 'initialize'], $token);
            $this->step('tools/list', $controller, ['jsonrpc' => '2.0', 'id' => 2, 'method' => 'tools/list'], $token);

            $callName = (string) $this->option('call');
            $arguments = match ($callName) {
                'call_application_api' => [
                    'slug' => (string) $this->option('slug'),
                    'path' => (string) $this->option('path'),
                    'method' => (string) $this->option('method'),
                ],
                'describe_application_api' => [
                    'slug' => (string) $this->option('slug'),
                ],
                default => [],
            };

            $this->step('tools/call', $controller, [
                'jsonrpc' => '2.0',
                'id' => 3,
                'method' => 'tools/call',
                'params' => ['name' => $callName, 'arguments' => $arguments],
            ], $token);
        } finally {
            ApiTokenAuth::revoke($user, $token);
            $this->comment('Test token revoked.');
        }

        return self::SUCCESS;
    }

    private function resolveUser(): ?User
    {
        $email = $this->option('email');

        if ($email) {
            return User::query()->where('email', $email)->first();
        }

        return User::query()->first();
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function step(string $label, McpController $controller, array $payload, string $token): void
    {
        $request = Request::create('/api/mcp', 'POST', [], [], [], [
            'HTTP_AUTHORIZATION' => "Bearer {$token}",
            'CONTENT_TYPE' => 'application/json',
        ], json_encode($payload));
        $request->headers->set('Authorization', "Bearer {$token}");

        $response = $controller->handle($request);

        $this->line("--- {$label} ---");
        $this->line((string) $response->getContent());
    }
}
