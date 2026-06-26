<?php

namespace App\Http\Controllers;

use App\Support\OAuthPublicUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OAuthDiscoveryController extends Controller
{
    /**
     * RFC 8414 authorization server metadata, so MCP clients (e.g. Claude's
     * "Add custom connector") can discover our OAuth endpoints automatically
     * instead of requiring manually pasted tokens.
     *
     * Issuer comes from MCP_PUBLIC_URL / FRONTEND_URL when set, so discovery
     * advertises the public SPA domain even if this response is served from
     * a separate API host behind a reverse proxy.
     */
    public function metadata(Request $request): JsonResponse
    {
        $issuer = OAuthPublicUrl::issuer($request);

        return response()->json([
            'issuer' => $issuer,
            'authorization_endpoint' => "{$issuer}/authorize",
            'token_endpoint' => "{$issuer}/token",
            'registration_endpoint' => "{$issuer}/register",
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
        $issuer = OAuthPublicUrl::issuer($request);

        return response()->json([
            'resource' => "{$issuer}/mcp",
            'authorization_servers' => [$issuer],
            'scopes_supported' => ['mcp'],
            'bearer_methods_supported' => ['header'],
        ]);
    }
}
