<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PushSubscription;
use App\Support\ApiTokenAuth;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PushSubscriptionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $this->currentUser($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        return response()->json(
            PushSubscription::query()
                ->where('user_id', $user->id)
                ->orderByDesc('created_at')
                ->get()
        );
    }

    public function store(Request $request): JsonResponse
    {
        $user = $this->currentUser($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'endpoint' => ['required', 'string', 'max:2048'],
            'keys' => ['required', 'array'],
            'keys.p256dh' => ['required', 'string', 'max:2048'],
            'keys.auth' => ['required', 'string', 'max:2048'],
            'contentEncoding' => ['nullable', 'in:aesgcm,aes128gcm'],
            'userAgent' => ['nullable', 'string', 'max:2048'],
        ]);

        $subscription = PushSubscription::query()->updateOrCreate(
            ['endpoint' => $validated['endpoint']],
            [
                'user_id' => $user->id,
                'public_key' => $validated['keys']['p256dh'],
                'auth_token' => $validated['keys']['auth'],
                'content_encoding' => $validated['contentEncoding'] ?? 'aes128gcm',
                'user_agent' => $validated['userAgent'] ?? $request->userAgent(),
            ]
        );

        return response()->json($subscription, 201);
    }

    public function destroy(Request $request): JsonResponse
    {
        $user = $this->currentUser($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'endpoint' => ['required', 'string', 'max:2048'],
        ]);

        PushSubscription::query()
            ->where('user_id', $user->id)
            ->where('endpoint', $validated['endpoint'])
            ->delete();

        return response()->json(status: 204);
    }

    private function currentUser(Request $request)
    {
        return ApiTokenAuth::userFromRequest($request);
    }
}