<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ApiTokenAuth
{
    public static function issueToken(User $user): string
    {
        $plainToken = Str::random(80);
        $user->forceFill([
            'remember_token' => hash('sha256', $plainToken),
        ])->save();

        return $plainToken;
    }

    public static function userFromRequest(Request $request): ?User
    {
        $token = self::tokenFromRequest($request);

        if (! $token) {
            return null;
        }

        return User::query()
            ->where('remember_token', hash('sha256', $token))
            ->first();
    }

    public static function revoke(User $user): void
    {
        $user->forceFill(['remember_token' => null])->save();
    }

    private static function tokenFromRequest(Request $request): ?string
    {
        $bearer = $request->bearerToken();
        if (! empty($bearer)) {
            return $bearer;
        }

        $headerToken = $request->header('X-Auth-Token');
        if (! empty($headerToken) && is_string($headerToken)) {
            return $headerToken;
        }

        return null;
    }
}
