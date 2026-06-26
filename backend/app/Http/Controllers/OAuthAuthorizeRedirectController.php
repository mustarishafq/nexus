<?php

namespace App\Http\Controllers;

use App\Models\OAuthClient;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class OAuthAuthorizeRedirectController extends Controller
{
    /**
     * Entry point a browser lands on when an MCP client starts the OAuth
     * flow. We validate the request server-side (so a misconfigured client
     * gets a clear error here, not a confusing one later) then hand off to
     * the frontend SPA, which already knows how to check the logged-in user
     * and render a consent screen.
     */
    public function __invoke(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'response_type' => ['required', 'in:code'],
            'client_id' => ['required', 'string'],
            'redirect_uri' => ['required', 'string'],
            'state' => ['nullable', 'string'],
            'scope' => ['nullable', 'string'],
            'code_challenge' => ['required', 'string'],
            'code_challenge_method' => ['required', 'in:S256'],
        ]);

        $client = OAuthClient::query()->where('client_id', $validated['client_id'])->first();

        if (! $client) {
            abort(400, 'Unknown client_id.');
        }

        if (! $client->allowsRedirectUri($validated['redirect_uri'])) {
            abort(400, 'redirect_uri is not registered for this client.');
        }

        $frontendUrl = rtrim((string) env('FRONTEND_URL', env('APP_URL', 'http://localhost:5173')), '/');

        return redirect()->away($frontendUrl.'/oauth/consent?'.http_build_query($validated));
    }
}
