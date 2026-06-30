<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuthToken;
use App\Models\OAuthAuthCode;
use App\Models\OAuthClient;
use App\Models\OAuthRefreshToken;
use App\Services\McpConnectionNotificationService;
use App\Services\McpOAuthProvisioningService;
use App\Support\ApiTokenAuth;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class OAuthController extends Controller
{
    private const AUTH_CODE_TTL_MINUTES = 10;

    private const ACCESS_TOKEN_TTL_MINUTES = 60;

    private const REFRESH_TOKEN_TTL_DAYS = 30;

    /**
     * RFC 7591 Dynamic Client Registration, so MCP clients (e.g. Claude's
     * "Add custom connector") can register themselves without a human
     * manually creating credentials first.
     */
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'client_name' => ['nullable', 'string', 'max:255'],
            'redirect_uris' => ['required', 'array', 'min:1'],
            'redirect_uris.*' => ['required', 'string', 'max:2048'],
            'token_endpoint_auth_method' => ['nullable', 'in:none,client_secret_post'],
        ]);

        $authMethod = $validated['token_endpoint_auth_method'] ?? 'none';
        $clientId = (string) Str::uuid();
        $plainSecret = null;

        $attributes = [
            'client_id' => $clientId,
            'name' => $validated['client_name'] ?? 'Unnamed MCP client',
            'redirect_uris' => $validated['redirect_uris'],
            'token_endpoint_auth_method' => $authMethod,
        ];

        if ($authMethod === 'client_secret_post') {
            $plainSecret = Str::random(48);
            $attributes['client_secret_hash'] = Hash::make($plainSecret);
        }

        $client = OAuthClient::create($attributes);

        return response()->json(array_filter([
            'client_id' => $client->client_id,
            'client_secret' => $plainSecret,
            'client_id_issued_at' => $client->created_at->timestamp,
            'client_name' => $client->name,
            'redirect_uris' => $client->redirect_uris,
            'token_endpoint_auth_method' => $client->token_endpoint_auth_method,
            'grant_types' => ['authorization_code', 'refresh_token'],
            'response_types' => ['code'],
        ], fn ($value) => $value !== null), 201);
    }

    /**
     * Public lookup so the consent screen can show which app is requesting
     * access. When redirect_uri is supplied, it is validated against the
     * client's registered URIs so Deny/Allow cannot target arbitrary URLs.
     */
    public function showClient(Request $request, string $clientId): JsonResponse
    {
        $client = OAuthClient::query()->where('client_id', $clientId)->first();

        if (! $client) {
            return response()->json(['message' => 'Unknown client'], 404);
        }

        $redirectUri = $request->query('redirect_uri');
        if ($redirectUri !== null && ! $client->allowsRedirectUri($redirectUri)) {
            return response()->json(['message' => 'redirect_uri is not registered for this client.'], 400);
        }

        return response()->json(['client_id' => $client->client_id, 'name' => $client->name]);
    }

    /**
     * Called by the frontend consent screen once a logged-in user clicks
     * Allow. Issues a short-lived authorization code and tells the frontend
     * where to redirect the browser back to (the MCP client's redirect_uri).
     */
    public function decide(Request $request): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'client_id' => ['required', 'string'],
            'redirect_uri' => ['required', 'string'],
            'state' => ['nullable', 'string'],
            'scope' => ['nullable', 'string'],
            'code_challenge' => ['required', 'string'],
            'code_challenge_method' => ['required', 'in:S256'],
        ]);

        $client = OAuthClient::query()->where('client_id', $validated['client_id'])->first();

        if (! $client || ! $client->allowsRedirectUri($validated['redirect_uri'])) {
            return response()->json(['message' => 'Invalid client or redirect_uri.'], 400);
        }

        app(McpOAuthProvisioningService::class)->provisionOnConsent($user);

        $plainCode = Str::random(64);

        OAuthAuthCode::create([
            'code_hash' => hash('sha256', $plainCode),
            'client_id' => $client->client_id,
            'user_id' => $user->id,
            'redirect_uri' => $validated['redirect_uri'],
            'code_challenge' => $validated['code_challenge'],
            'code_challenge_method' => $validated['code_challenge_method'],
            'scope' => $validated['scope'] ?? null,
            'expires_at' => now()->addMinutes(self::AUTH_CODE_TTL_MINUTES),
        ]);

        $query = ['code' => $plainCode];
        if (! empty($validated['state'])) {
            $query['state'] = $validated['state'];
        }

        return response()->json([
            'redirect_to' => $validated['redirect_uri'].(str_contains($validated['redirect_uri'], '?') ? '&' : '?').http_build_query($query),
        ]);
    }

    /**
     * RFC 6749 token endpoint: exchanges an authorization code (with PKCE
     * verification) or a refresh token for a fresh access token.
     */
    public function token(Request $request): JsonResponse
    {
        $grantType = (string) $request->input('grant_type');

        return match ($grantType) {
            'authorization_code' => $this->exchangeAuthorizationCode($request),
            'refresh_token' => $this->exchangeRefreshToken($request),
            default => response()->json(['error' => 'unsupported_grant_type'], 400),
        };
    }

    private function exchangeAuthorizationCode(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string'],
            'redirect_uri' => ['required', 'string'],
            'client_id' => ['required', 'string'],
            'client_secret' => ['nullable', 'string'],
            'code_verifier' => ['required', 'string'],
        ]);

        $client = OAuthClient::query()->where('client_id', $validated['client_id'])->first();

        if (! $client || ! $this->clientSecretValid($client, $validated['client_secret'] ?? null)) {
            return response()->json(['error' => 'invalid_client'], 401);
        }

        $authCode = OAuthAuthCode::query()
            ->where('code_hash', hash('sha256', $validated['code']))
            ->where('client_id', $client->client_id)
            ->first();

        if (! $authCode || $authCode->isExpired()) {
            return response()->json(['error' => 'invalid_grant'], 400);
        }

        if ($authCode->redirect_uri !== $validated['redirect_uri']) {
            return response()->json(['error' => 'invalid_grant', 'error_description' => 'redirect_uri mismatch'], 400);
        }

        if (! $this->pkceValid($authCode, $validated['code_verifier'])) {
            return response()->json(['error' => 'invalid_grant', 'error_description' => 'PKCE verification failed'], 400);
        }

        $claimed = OAuthAuthCode::query()
            ->where('id', $authCode->id)
            ->whereNull('used_at')
            ->update(['used_at' => now()]);

        if ($claimed === 0) {
            return response()->json(['error' => 'invalid_grant'], 400);
        }

        $user = $authCode->user;

        return response()->json(
            $this->issueTokenPair($user, $client)
        );
    }

    private function exchangeRefreshToken(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'refresh_token' => ['required', 'string'],
            'client_id' => ['required', 'string'],
            'client_secret' => ['nullable', 'string'],
        ]);

        $client = OAuthClient::query()->where('client_id', $validated['client_id'])->first();

        if (! $client || ! $this->clientSecretValid($client, $validated['client_secret'] ?? null)) {
            return response()->json(['error' => 'invalid_client'], 401);
        }

        $refreshToken = OAuthRefreshToken::query()
            ->where('token_hash', hash('sha256', $validated['refresh_token']))
            ->where('client_id', $client->client_id)
            ->first();

        if (! $refreshToken || ! $refreshToken->isUsable()) {
            return response()->json(['error' => 'invalid_grant'], 400);
        }

        $refreshToken->forceFill(['revoked_at' => now()])->save();
        $refreshToken->authToken?->delete();

        return response()->json(
            $this->issueTokenPair($refreshToken->user, $client)
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function issueTokenPair(\App\Models\User $user, OAuthClient $client): array
    {
        $notifier = app(McpConnectionNotificationService::class);
        $isFirstConnection = $notifier->isFirstOAuthConnection($user);
        $label = $this->mcpTokenLabel($client);

        AuthToken::query()
            ->where('user_id', $user->id)
            ->where('oauth_client_id', $client->client_id)
            ->delete();

        [$accessToken, $authTokenModel] = ApiTokenAuth::issueOAuthAccessToken(
            $user,
            $client->client_id,
            self::ACCESS_TOKEN_TTL_MINUTES,
            $label
        );

        if ($isFirstConnection) {
            $notifier->notifyAdminsOfNewConnection($user->fresh(), $client, $authTokenModel);
        }

        $plainRefreshToken = Str::random(80);

        OAuthRefreshToken::create([
            'token_hash' => hash('sha256', $plainRefreshToken),
            'auth_token_id' => $authTokenModel->id,
            'client_id' => $client->client_id,
            'user_id' => $user->id,
            'expires_at' => now()->addDays(self::REFRESH_TOKEN_TTL_DAYS),
        ]);

        return [
            'access_token' => $accessToken,
            'token_type' => 'Bearer',
            'expires_in' => self::ACCESS_TOKEN_TTL_MINUTES * 60,
            'refresh_token' => $plainRefreshToken,
            'scope' => 'mcp',
        ];
    }

    private function mcpTokenLabel(OAuthClient $client): string
    {
        $name = trim((string) $client->name);

        return 'MCP: '.($name !== '' ? $name : 'Unnamed client');
    }

    private function clientSecretValid(OAuthClient $client, ?string $providedSecret): bool
    {
        if ($client->token_endpoint_auth_method !== 'client_secret_post') {
            return true;
        }

        return $providedSecret !== null && $client->client_secret_hash
            && Hash::check($providedSecret, $client->client_secret_hash);
    }

    private function pkceValid(OAuthAuthCode $authCode, string $codeVerifier): bool
    {
        $computed = rtrim(strtr(base64_encode(hash('sha256', $codeVerifier, true)), '+/', '-_'), '=');

        return hash_equals($authCode->code_challenge, $computed);
    }
}
