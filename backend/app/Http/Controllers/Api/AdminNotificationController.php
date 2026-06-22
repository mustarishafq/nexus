<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AdminNotificationService;
use App\Support\ApiTokenAuth;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminNotificationController extends Controller
{
    public function send(Request $request): JsonResponse
    {
        if ($response = $this->authorizeAdmin($request)) {
            return $response;
        }

        $validated = $request->validate([
            'user_ids' => ['required', 'array', 'min:1'],
            'user_ids.*' => ['integer', 'exists:users,id'],
            'title' => ['required', 'string', 'max:255'],
            'message' => ['nullable', 'string', 'max:5000'],
            'send_in_app' => ['sometimes', 'boolean'],
            'send_web_push' => ['sometimes', 'boolean'],
            'type' => ['sometimes', Rule::in(['info', 'success', 'warning', 'error', 'critical'])],
            'priority' => ['sometimes', Rule::in(['low', 'medium', 'high', 'critical'])],
            'action_url' => ['nullable', 'string', 'max:2048'],
        ]);

        $sendInApp = (bool) ($validated['send_in_app'] ?? true);
        $sendWebPush = (bool) ($validated['send_web_push'] ?? true);

        if (! $sendInApp && ! $sendWebPush) {
            return response()->json([
                'message' => 'Choose at least one delivery channel: in-app or web push.',
                'errors' => [
                    'send_in_app' => ['Choose at least one delivery channel.'],
                ],
            ], 422);
        }

        $admin = ApiTokenAuth::userFromRequest($request);

        $result = app(AdminNotificationService::class)->sendToUsers(
            $admin,
            $validated['user_ids'],
            $validated['title'],
            $validated['message'] ?? null,
            $sendInApp,
            $sendWebPush,
            $validated['type'] ?? 'info',
            $validated['priority'] ?? 'medium',
            $validated['action_url'] ?? null,
        );

        if ($result['sent'] === 0) {
            return response()->json([
                'message' => $result['errors'][0] ?? 'No notifications were sent.',
                ...$result,
            ], 422);
        }

        return response()->json([
            'message' => "Sent notification to {$result['sent']} user(s).",
            ...$result,
        ]);
    }

    private function authorizeAdmin(Request $request): ?JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return null;
    }
}
