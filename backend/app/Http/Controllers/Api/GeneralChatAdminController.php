<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AuthorizesRoles;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\GeneralChat\GeneralChatQuotaService;
use App\Support\PermissionCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GeneralChatAdminController extends Controller
{
    use AuthorizesRoles;

    public function __construct(private GeneralChatQuotaService $quota) {}

    public function show(Request $request, User $user): JsonResponse
    {
        if ($response = $this->authorizePermission($request, PermissionCatalog::PEOPLE_MANAGE_USERS)) {
            return $response;
        }

        return response()->json([
            'user_id' => $user->id,
            'quota' => $this->quota->snapshot($user),
        ]);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        if ($response = $this->authorizePermission($request, PermissionCatalog::PEOPLE_MANAGE_USERS)) {
            return $response;
        }

        $validated = $request->validate([
            'token_limit' => ['present', 'nullable', 'integer', 'min:0', 'max:100000000'],
        ]);

        $user->forceFill([
            'general_chat_token_limit' => $validated['token_limit'],
        ])->save();

        return response()->json([
            'user_id' => $user->id,
            'quota' => $this->quota->snapshot($user->fresh()),
        ]);
    }

    public function topup(Request $request, User $user): JsonResponse
    {
        if ($response = $this->authorizePermission($request, PermissionCatalog::PEOPLE_MANAGE_USERS)) {
            return $response;
        }

        $validated = $request->validate([
            'tokens' => ['required', 'integer', 'min:1', 'max:100000000'],
            'note' => ['sometimes', 'nullable', 'string', 'max:500'],
        ]);

        $actor = $this->authenticatedUser($request);
        $grant = $this->quota->grant(
            $user,
            (int) $validated['tokens'],
            $actor,
            $validated['note'] ?? null,
        );

        return response()->json([
            'user_id' => $user->id,
            'grant' => [
                'id' => $grant->id,
                'tokens' => $grant->tokens,
                'note' => $grant->note,
                'period_starts_at' => optional($grant->period_starts_at)?->toIso8601String(),
            ],
            'quota' => $this->quota->snapshot($user),
        ]);
    }
}
