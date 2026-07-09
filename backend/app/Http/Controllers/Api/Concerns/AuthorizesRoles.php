<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Models\User;
use App\Support\ApiTokenAuth;
use App\Support\UserRoles;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

trait AuthorizesRoles
{
    /**
     * @param  string|list<string>  $roles
     */
    protected function authorizeRoles(Request $request, string|array $roles): ?JsonResponse
    {
        $user = $this->authenticatedUser($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (! UserRoles::hasRole($user, $roles)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return null;
    }

    protected function authorizeAdmin(Request $request): ?JsonResponse
    {
        return $this->authorizeRoles($request, UserRoles::ADMIN);
    }

    protected function authorizeHrOrAdmin(Request $request): ?JsonResponse
    {
        return $this->authorizeRoles($request, [UserRoles::ADMIN, UserRoles::HR]);
    }

    protected function authenticatedUser(Request $request): ?User
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user || ! $user->is_approved) {
            return null;
        }

        return $user;
    }
}
