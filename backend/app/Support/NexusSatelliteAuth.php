<?php

namespace App\Support;

use App\Models\Application;
use App\Models\ApplicationSsoCredential;
use App\Models\User;
use App\Services\ApplicationApiClient;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NexusSatelliteAuth
{
    /**
     * Authenticate a satellite service call via X-Nexus-Api-Key and/or service JWT.
     *
     * @param  list<string>  $allowedAudiences
     * @return Application|JsonResponse
     */
    public static function authenticate(Request $request, array $allowedAudiences = []): Application|JsonResponse
    {
        $headerKey = trim((string) $request->header('X-Nexus-Api-Key', ''));
        $bearer = $request->bearerToken();

        if ($headerKey !== '') {
            $application = self::findApplicationByApiKey($headerKey);
            if (! $application) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            if ($bearer && ! self::jwtValidForApplication($bearer, $application, $allowedAudiences)) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            return $application;
        }

        if ($bearer) {
            $application = self::findApplicationForJwt($bearer, $allowedAudiences);
            if ($application) {
                return $application;
            }
        }

        return response()->json(['message' => 'Unauthorized'], 401);
    }

    public static function findApplicationByApiKey(string $apiKey): ?Application
    {
        if ($apiKey === '') {
            return null;
        }

        return Application::query()
            ->whereNotNull('api_key')
            ->where('api_key', '!=', '')
            ->get()
            ->first(fn (Application $app) => hash_equals((string) $app->api_key, $apiKey));
    }

    /**
     * @param  list<string>  $allowedAudiences
     */
    public static function findApplicationForJwt(string $token, array $allowedAudiences = []): ?Application
    {
        $candidates = Application::query()
            ->whereNotNull('api_key')
            ->where('api_key', '!=', '')
            ->get();

        foreach ($candidates as $application) {
            if (self::jwtValidForApplication($token, $application, $allowedAudiences)) {
                return $application;
            }
        }

        return null;
    }

    /**
     * @param  list<string>  $allowedAudiences
     */
    public static function jwtValidForApplication(string $token, Application $application, array $allowedAudiences = []): bool
    {
        $apiKey = (string) ($application->api_key ?? '');
        if ($apiKey === '') {
            return false;
        }

        try {
            $payload = (array) JWT::decode($token, new Key($apiKey, 'HS256'));
        } catch (\Throwable) {
            return false;
        }

        $isService = ($payload['sub'] ?? null) === 'system'
            || ($payload['typ'] ?? null) === 'service';

        if (! $isService) {
            return false;
        }

        if ($allowedAudiences === []) {
            return true;
        }

        $aud = $payload['aud'] ?? null;
        if (is_array($aud)) {
            foreach ($aud as $value) {
                if (in_array((string) $value, $allowedAudiences, true)) {
                    return true;
                }
            }

            return false;
        }

        return in_array((string) $aud, $allowedAudiences, true);
    }

    /**
     * Who the satellite is calling on behalf of (optional).
     *
     * @param  array<string, mixed>  $payload
     */
    public static function actingUser(Request $request, Application $application, array $payload = []): ?User
    {
        $userBlock = is_array($payload['user'] ?? null) ? $payload['user'] : [];

        $id = trim((string) $request->header(ApplicationApiClient::ACTING_USER_ID_HEADER, ''));
        if ($id === '') {
            $id = trim((string) ($payload['user_id'] ?? $payload['nexus_user_id'] ?? $userBlock['id'] ?? $userBlock['user_id'] ?? ''));
        }

        $email = trim((string) $request->header(ApplicationApiClient::ACTING_EMAIL_HEADER, ''));
        if ($email === '') {
            $email = trim((string) ($payload['user_email'] ?? $userBlock['email'] ?? ''));
        }

        $bearer = $request->bearerToken();
        if ($bearer) {
            $claims = self::jwtPayload($bearer, $application);
            if (is_array($claims)) {
                if ($id === '') {
                    $claimId = $claims['user_id'] ?? $claims['uid'] ?? $claims['nexus_user_id'] ?? null;
                    $sub = $claims['sub'] ?? null;
                    if ($claimId !== null && $claimId !== '') {
                        $id = trim((string) $claimId);
                    } elseif (is_numeric($sub)) {
                        $id = (string) $sub;
                    }
                }
                if ($email === '' && ! empty($claims['email'])) {
                    $email = trim((string) $claims['email']);
                }
            }
        }

        if ($id !== '' && ctype_digit($id)) {
            $user = User::query()->find((int) $id);
            if ($user) {
                return $user;
            }
        }

        if ($email === '') {
            return null;
        }

        $normalized = strtolower($email);
        $user = User::query()->whereRaw('LOWER(email) = ?', [$normalized])->first();
        if ($user) {
            return $user;
        }

        $credential = ApplicationSsoCredential::query()
            ->where('application_id', $application->id)
            ->where('status', ApplicationSsoCredential::STATUS_APPROVED)
            ->whereRaw('LOWER(email) = ?', [$normalized])
            ->first();

        return $credential?->user;
    }

    /**
     * @return array<string, mixed>|null
     */
    private static function jwtPayload(string $token, Application $application): ?array
    {
        $apiKey = (string) ($application->api_key ?? '');
        if ($apiKey === '') {
            return null;
        }

        try {
            return (array) JWT::decode($token, new Key($apiKey, 'HS256'));
        } catch (\Throwable) {
            return null;
        }
    }
}
