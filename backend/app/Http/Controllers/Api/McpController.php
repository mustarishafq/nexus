<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Mcp\McpJsonSchema;
use App\Services\Mcp\ToolRegistry;
use App\Support\ApiTokenAuth;
use App\Support\OAuthPublicUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class McpController extends Controller
{
    public function __construct(private ToolRegistry $tools) {}

    /**
     * Single JSON-RPC 2.0 endpoint implementing the MCP methods Nexus
     * supports: initialize, tools/list, tools/call.
     */
    public function handle(Request $request): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            $issuer = OAuthPublicUrl::issuer($request);

            return $this->error(null, -32001, 'Unauthorized', 401)
                ->header('WWW-Authenticate', 'Bearer resource_metadata="'.$issuer.'/.well-known/oauth-protected-resource/mcp"');
        }

        $id = $request->input('id');
        $method = (string) $request->input('method');
        $params = (array) $request->input('params', []);

        return match ($method) {
            'initialize' => $this->result($id, [
                'protocolVersion' => '2024-11-05',
                'serverInfo' => ['name' => 'nexus-mcp', 'version' => '1.0.0'],
                'capabilities' => ['tools' => ['listChanged' => false]],
            ]),
            'tools/list' => $this->result($id, [
                'tools' => array_map(
                    fn ($tool) => [
                        'name' => $tool->name(),
                        'description' => $tool->description(),
                        'inputSchema' => McpJsonSchema::normalize($tool->inputSchema()),
                    ],
                    array_values($this->tools->all())
                ),
            ]),
            'tools/call' => $this->callTool($id, $user, $params),
            default => $this->error($id, -32601, "Method not found: {$method}"),
        };
    }

    /**
     * @param  array<string, mixed>  $params
     */
    private function callTool(mixed $id, $user, array $params): JsonResponse
    {
        $name = (string) ($params['name'] ?? '');
        $arguments = (array) ($params['arguments'] ?? []);

        $tool = $this->tools->find($name);

        if (! $tool) {
            return $this->error($id, -32602, "Unknown tool: {$name}");
        }

        try {
            $output = $tool->call($user, $arguments);
        } catch (\Throwable $e) {
            return $this->result($id, [
                'content' => [['type' => 'text', 'text' => $e->getMessage()]],
                'isError' => true,
            ]);
        }

        return $this->result($id, [
            'content' => [['type' => 'text', 'text' => json_encode($output)]],
            'isError' => false,
        ]);
    }

    private function result(mixed $id, array $result): JsonResponse
    {
        return response()->json(['jsonrpc' => '2.0', 'id' => $id, 'result' => $result]);
    }

    private function error(mixed $id, int $code, string $message, int $httpStatus = 200): JsonResponse
    {
        return response()->json([
            'jsonrpc' => '2.0',
            'id' => $id,
            'error' => ['code' => $code, 'message' => $message],
        ], $httpStatus);
    }
}
