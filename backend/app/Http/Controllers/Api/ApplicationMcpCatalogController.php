<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Services\ApplicationApiClient;
use App\Support\ApiTokenAuth;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ApplicationMcpCatalogController extends Controller
{
    public function test(Request $request, Application $application, ApplicationApiClient $client): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (! $this->canEditSystem($user, $application)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'base_url' => ['nullable', 'string', 'max:2048'],
            'mcp_catalog_path' => ['nullable', 'string', 'max:255'],
            'mcp_api_key' => ['nullable', 'string', 'max:255'],
            'mcp_auth_mode' => ['nullable', 'in:bearer,x-api-key'],
            'api_key' => ['nullable', 'string', 'max:255'],
            'notification_config' => ['nullable', 'array'],
        ]);

        $overrides = $validated;

        return response()->json($client->testCatalog($application, $overrides));
    }

    private function canEditSystem($user, Application $application): bool
    {
        if ($user->role === 'admin') {
            return true;
        }

        return (int) $application->created_by_user_id === (int) $user->id;
    }
}
