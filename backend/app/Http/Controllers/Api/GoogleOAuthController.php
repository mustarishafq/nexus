<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GoogleOAuthToken;
use App\Models\User;
use App\Support\ApiTokenAuth;
use Google\Client;
use Google\Service\Calendar;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Str;
use Throwable;

class GoogleOAuthController extends Controller
{
    protected const CACHE_PREFIX = 'google_oauth_state:';

    public function connect(Request $request): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (! filled(config('services.google_oauth.client_id')) || ! filled(config('services.google_oauth.client_secret'))) {
            return response()->json([
                'message' => 'Google OAuth client is not configured. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET.',
            ], 422);
        }

        $client = $this->oauthClient($request);
        $state = Str::random(48);

        Cache::put(self::CACHE_PREFIX . $state, [
            'user_id' => $user->id,
        ], now()->addMinutes(10));

        $client->setState($state);

        return response()->json([
            'auth_url' => $client->createAuthUrl(),
            'state' => $state,
        ]);
    }

    public function callback(Request $request): RedirectResponse
    {
        $state = (string) $request->query('state', '');
        $frontendRedirect = $this->frontendRedirectUrl();

        if ($state === '') {
            return redirect($frontendRedirect . '?google_oauth=error&reason=missing_state');
        }

        $cachedState = Cache::pull(self::CACHE_PREFIX . $state);

        if (! is_array($cachedState) || empty($cachedState['user_id'])) {
            return redirect($frontendRedirect . '?google_oauth=error&reason=invalid_state');
        }

        $user = User::query()->find($cachedState['user_id']);

        if (! $user) {
            return redirect($frontendRedirect . '?google_oauth=error&reason=user_not_found');
        }

        $code = (string) $request->query('code', '');

        if ($code === '') {
            return redirect($frontendRedirect . '?google_oauth=error&reason=missing_code');
        }

        $client = $this->oauthClient($request);
        $token = $client->fetchAccessTokenWithAuthCode($code);

        if (isset($token['error'])) {
            return redirect($frontendRedirect . '?google_oauth=error&reason=token_exchange_failed');
        }

        $existing = GoogleOAuthToken::query()
            ->where('user_id', $user->id)
            ->where('provider', 'google')
            ->first();

        $existingRefreshToken = null;
        if ($existing && $existing->refresh_token) {
            try {
                $existingRefreshToken = Crypt::decryptString($existing->refresh_token);
            } catch (Throwable) {
                $existingRefreshToken = null;
            }
        }

        $refreshToken = $token['refresh_token'] ?? $existingRefreshToken;
        $expiresIn = isset($token['expires_in']) ? (int) $token['expires_in'] : null;

        GoogleOAuthToken::query()->updateOrCreate(
            [
                'user_id' => $user->id,
                'provider' => 'google',
            ],
            [
                'access_token' => Crypt::encryptString((string) ($token['access_token'] ?? '')),
                'refresh_token' => $refreshToken ? Crypt::encryptString($refreshToken) : null,
                'expires_at' => $expiresIn ? now()->addSeconds($expiresIn) : null,
                'token_type' => (string) ($token['token_type'] ?? ''),
                'scopes' => is_array($token['scope'] ?? null)
                    ? implode(' ', $token['scope'])
                    : (string) ($token['scope'] ?? ''),
            ]
        );

        return redirect($frontendRedirect . '?google_oauth=connected');
    }

    public function status(Request $request): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $token = GoogleOAuthToken::query()
            ->where('user_id', $user->id)
            ->where('provider', 'google')
            ->first();

        return response()->json([
            'connected' => (bool) $token,
            'expires_at' => $token && $token->expires_at ? $token->expires_at->toISOString() : null,
        ]);
    }

    public function disconnect(Request $request): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        GoogleOAuthToken::query()
            ->where('user_id', $user->id)
            ->where('provider', 'google')
            ->delete();

        return response()->json(['message' => 'Google account disconnected.']);
    }

    protected function oauthClient(Request $request): Client
    {
        $client = new Client();
        $client->setClientId((string) config('services.google_oauth.client_id'));
        $client->setClientSecret((string) config('services.google_oauth.client_secret'));
        $client->setRedirectUri($this->oauthRedirectUri($request));
        $client->setAccessType('offline');
        $client->setPrompt('consent select_account');
        $client->setIncludeGrantedScopes(true);
        $client->setScopes([Calendar::CALENDAR]);

        return $client;
    }

    protected function oauthRedirectUri(Request $request): string
    {
        $configured = trim((string) config('services.google_oauth.redirect_uri'));

        if ($configured !== '') {
            return $configured;
        }

        return rtrim($request->getSchemeAndHttpHost(), '/') . '/api/google/oauth/callback';
    }

    protected function frontendRedirectUrl(): string
    {
        $configured = trim((string) config('services.google_oauth.frontend_redirect_url'));

        if ($configured !== '') {
            return $configured;
        }

        return rtrim((string) config('app.url'), '/') . '/admin/calendar';
    }
}
