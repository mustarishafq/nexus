<?php

namespace App\Support;

use App\Models\AuthToken;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ApiTokenAuth
{
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
     * Issue an access token on behalf of an OAuth client (used by the
     * /oauth/token endpoint), tagged with oauth_client_id for auditing /
     * revocation, separate from personal API tokens.
     */
    public static function issueOAuthAccessToken(User $user, string $clientId, int $ttlMinutes): array
    {
        $plainToken = Str::random(80);

        $authToken = AuthToken::create([
            'user_id' => $user->id,
            'oauth_client_id' => $clientId,
            'token_hash' => hash('sha256', $plainToken),
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

            return User::query()->find($authToken->user_id);
        }

        return User::query()
            ->where('remember_token', $hash)
            ->first();
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
