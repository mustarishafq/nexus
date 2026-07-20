<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AuthorizesRoles;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\AuthToken;
use App\Models\User;
use App\Support\ApiTokenAuth;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ImpersonateController extends Controller
{
    use AuthorizesRoles;

    private const TOKEN_TTL_HOURS = 2;

    private const LABEL_PREFIX = 'impersonation:';

    public function start(Request $request, User $user): JsonResponse
    {
        if ($response = $this->authorizeAdmin($request)) {
            return $response;
        }

        $admin = $this->authenticatedUser($request);

        if ((int) $user->id === (int) $admin->id) {
            return response()->json([
                'message' => 'You cannot preview as yourself.',
            ], 422);
        }

        if (! $user->is_approved) {
            return response()->json([
                'message' => 'You can only preview as an approved user.',
            ], 422);
        }

        $token = ApiTokenAuth::issueToken($user, [
            'label' => self::LABEL_PREFIX.$admin->id,
            'expires_at' => now()->addHours(self::TOKEN_TTL_HOURS),
        ]);

        ActivityLog::create([
            'user_id' => (string) $admin->id,
            'user_name' => $admin->full_name ?? $admin->name ?? $admin->email,
            'action' => 'other',
            'description' => 'Started preview as '.($user->full_name ?? $user->name ?? $user->email),
            'resource_type' => 'user',
            'resource_id' => (string) $user->id,
            'ip_address' => $request->ip(),
            'metadata' => [
                'event' => 'impersonation_start',
                'admin_id' => $admin->id,
                'target_user_id' => $user->id,
            ],
        ]);

        return response()->json([
            'message' => 'Preview session started.',
            'token' => $token,
            'user' => $user->fresh(),
        ]);
    }

    public function stop(Request $request): JsonResponse
    {
        $plainToken = $request->bearerToken();
        if (! $plainToken) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $authToken = AuthToken::query()
            ->where('token_hash', hash('sha256', $plainToken))
            ->first();

        if (! $authToken) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $label = (string) $authToken->label;
        if (! str_starts_with($label, self::LABEL_PREFIX)) {
            return response()->json([
                'message' => 'Current session is not a preview session.',
            ], 422);
        }

        $user = User::query()->find($authToken->user_id);
        $adminId = (int) substr($label, strlen(self::LABEL_PREFIX));

        ActivityLog::create([
            'user_id' => (string) ($adminId ?: $authToken->user_id),
            'user_name' => $user?->full_name ?? $user?->name ?? $user?->email ?? 'Unknown',
            'action' => 'other',
            'description' => 'Stopped preview as '.($user?->full_name ?? $user?->name ?? $user?->email ?? 'user'),
            'resource_type' => 'user',
            'resource_id' => (string) $authToken->user_id,
            'ip_address' => $request->ip(),
            'metadata' => [
                'event' => 'impersonation_stop',
                'admin_id' => $adminId ?: null,
                'target_user_id' => $authToken->user_id,
            ],
        ]);

        $authToken->delete();

        return response()->json([
            'message' => 'Preview session ended.',
        ]);
    }
}
