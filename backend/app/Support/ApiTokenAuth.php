<?php

namespace App\Support;

use App\Models\AuthToken;
use App\Models\User;
use App\Services\UserPresenceService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class ApiTokenAuth
{
    /** How often authenticated session activity may refresh users.last_login_at. */
    private const LAST_LOGIN_REFRESH_SECONDS = 60;

    /**
     * @param  array{label?: string|null, expires_at?: \DateTimeInterface|null}  $options
     */
    public static function issueToken(User $user, array $options = []): string
    {
        $plainToken = Str::random(80);
        $label = $options['label'] ?? null;

        if (array_key_exists('expires_at', $options)) {
            $expiresAt = $options['expires_at'];
        } elseif ($label !== null) {
            $expiresAt = null;
        } else {
            $lifetime = config('auth.api_token_lifetime');
            $expiresAt = $lifetime ? now()->addMinutes((int) $lifetime) : null;
        }

        AuthToken::create([
            'user_id' => $user->id,
            'token_hash' => hash('sha256', $plainToken),
            'label' => $label,
            'last_used_at' => now(),
            'expires_at' => $expiresAt,
        ]);

        return $plainToken;
    }

    /**
     * @param  array{label?: string|null, expires_at?: \DateTimeInterface|null, oauth_client_id?: string|null}  $options
     */
    public static function issueOAuthAccessToken(User $user, string $clientId, int $ttlMinutes, ?string $label = null): array
    {
        $plainToken = Str::random(80);

        $authToken = AuthToken::create([
            'user_id' => $user->id,
            'oauth_client_id' => $clientId,
            'token_hash' => hash('sha256', $plainToken),
            'label' => $label,
            'last_used_at' => now(),
            'expires_at' => now()->addMinutes($ttlMinutes),
        ]);

        return [$plainToken, $authToken];
    }

    public static function userFromRequest(Request $request): ?User
    {
        $token = $request->bearerToken();

        if (! $token) {
            return null;
        }

        return self::userFromToken($token);
    }

    public static function authTokenFromRequest(Request $request): ?AuthToken
    {
        $token = $request->bearerToken();
        if (! $token) {
            return null;
        }

        return AuthToken::query()
            ->where('token_hash', hash('sha256', $token))
            ->first();
    }

    public static function userFromToken(string $token): ?User
    {
        $hash = hash('sha256', $token);

        $authToken = AuthToken::query()->where('token_hash', $hash)->first();
        if ($authToken) {
            if ($authToken->isExpired()) {
                $authToken->delete();

                return null;
            }

            $authToken->touchLastUsed();

            $user = User::query()->find($authToken->user_id);
            if ($user) {
                app(UserPresenceService::class)->touchIfNeeded($user->id);
                if (self::isSessionToken($authToken)) {
                    self::refreshLastLoginIfNeeded($user);
                }
            }

            return $user;
        }

        $user = User::query()
            ->where('remember_token', $hash)
            ->first();

        if ($user) {
            app(UserPresenceService::class)->touchIfNeeded($user->id);
            self::refreshLastLoginIfNeeded($user);
        }

        return $user;
    }

    /**
     * Session tokens are browser logins (no label / OAuth client).
     * Personal API tokens, MCP tokens, and impersonation previews are excluded.
     */
    public static function isSessionToken(?AuthToken $authToken): bool
    {
        if (! $authToken) {
            // Legacy remember_token sessions are treated as browser sessions.
            return true;
        }

        return $authToken->label === null && $authToken->oauth_client_id === null;
    }

    /**
     * Keep last_login_at aligned with active sessions so long-lived tokens
     * do not leave the admin table stuck on an old credential login time.
     */
    public static function refreshLastLoginIfNeeded(User $user): void
    {
        $throttleKey = 'user_last_login_refresh:'.$user->id;
        if (Cache::has($throttleKey)) {
            return;
        }

        Cache::put($throttleKey, true, self::LAST_LOGIN_REFRESH_SECONDS);

        User::query()
            ->whereKey($user->id)
            ->update(['last_login_at' => now()]);

        $user->last_login_at = now();
    }

    public static function revoke(User $user, ?string $plainToken = null): void
    {
        if ($plainToken) {
            AuthToken::query()
                ->where('user_id', $user->id)
                ->where('token_hash', hash('sha256', $plainToken))
                ->delete();
        } else {
            AuthToken::query()->where('user_id', $user->id)->delete();
        }

        if ($plainToken && hash_equals((string) $user->remember_token, hash('sha256', $plainToken))) {
            $user->forceFill(['remember_token' => null])->save();
        }
    }
}
