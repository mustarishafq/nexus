<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OAuthDiscoveryController extends Controller
{
    /**
     * RFC 8414 authorization server metadata, so MCP clients (e.g. Claude's
     * "Add custom connector") can discover our OAuth endpoints automatically
     * instead of requiring manually pasted tokens.
     *
     * Derived from the incoming request rather than config('app.url'),
     * since that config value is repurposed elsewhere in this app to point
     * at the frontend origin, not this API's own origin.
     */
    public function metadata(Request $request): JsonResponse
    {
        $issuer = rtrim($request->getSchemeAndHttpHost(), '/');

        return response()->json([
            'issuer' => $issuer,
            'authorization_endpoint' => "{$issuer}/oauth/authorize",
            'token_endpoint' => "{$issuer}/api/oauth/token",
            'registration_endpoint' => "{$issuer}/api/oauth/register",
            'scopes_supported' => ['mcp'],
            'response_types_supported' => ['code'],
            'grant_types_supported' => ['authorization_code', 'refresh_token'],
            'code_challenge_methods_supported' => ['S256'],
            'token_endpoint_auth_methods_supported' => ['none', 'client_secret_post'],
        ]);
    }

    /**
     * RFC 9728 protected resource metadata for /mcp, pointing clients at
     * this same authorization server.
     */
    public function protectedResource(Request $request): JsonResponse
    {
        $issuer = rtrim($request->getSchemeAndHttpHost(), '/');

        return response()->json([
            'resource' => "{$issuer}/mcp",
            'authorization_servers' => [$issuer],
        ]);
    }
}
