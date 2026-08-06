<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\UserPresenceService;
use App\Support\ApiTokenAuth;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PresenceController extends Controller
{
    public function heartbeat(Request $request): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        app(UserPresenceService::class)->touch($user->id);

        $authToken = ApiTokenAuth::authTokenFromRequest($request);
        if (ApiTokenAuth::isSessionToken($authToken)) {
            ApiTokenAuth::refreshLastLoginIfNeeded($user);
        }

        return response()->json([
            'ok' => true,
            'last_login_at' => $user->last_login_at?->toISOString(),
        ]);
    }

    public function online(Request $request): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $presence = app(UserPresenceService::class);
        $userIds = $presence->onlineUserIds();

        return response()->json([
            'user_ids' => $userIds,
            'last_seen' => $presence->lastSeenMapFor($userIds),
        ]);
    }
}
