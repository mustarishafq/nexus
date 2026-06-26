<?php

namespace App\Support;

use Illuminate\Http\Request;

class OAuthPublicUrl
{
    /**
     * Public origin for MCP/OAuth discovery (issuer, resource URLs).
     * Defaults to FRONTEND_URL so connectors can use the SPA domain
     * (e.g. emzinexus.com/mcp) while the API runs on a separate host.
     */
    public static function issuer(?Request $request = null): string
    {
        $configured = config('services.mcp.public_url');

        if (is_string($configured) && $configured !== '') {
            return rtrim($configured, '/');
        }

        if ($request !== null) {
            return rtrim($request->getSchemeAndHttpHost(), '/');
        }

        return rtrim((string) config('app.url'), '/');
    }
}
