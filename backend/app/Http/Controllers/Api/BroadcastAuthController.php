<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\ApiTokenAuth;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Broadcast;

class BroadcastAuthController extends Controller
{
    /**
     * Authorize private channel subscriptions using Bearer API tokens.
     */
    public function __invoke(Request $request): JsonResponse|\Illuminate\Http\Response
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user?->is_approved) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        // Bind the authenticated user for Broadcast::auth channel callbacks.
        $request->setUserResolver(fn () => $user);

        try {
            return Broadcast::auth($request);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
    }
}
