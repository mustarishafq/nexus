<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ResolvesDepartmentInput;
use App\Http\Controllers\Controller;
use App\Support\ApiTokenAuth;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class MeController extends Controller
{
    use ResolvesDepartmentInput;

    public function show(Request $request): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (! $user->is_approved) {
            return response()->json([
                'message' => 'Your account is pending admin approval.',
                'code' => 'account_not_approved',
            ], 403);
        }

        return response()->json($user->load('department'));
    }

    public function update(Request $request): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'full_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'profile_picture' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'cover_picture' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'bio' => ['sometimes', 'nullable', 'string', 'max:500'],
            'department_id' => ['sometimes', 'nullable', 'integer', 'exists:departments,id'],
            'department' => ['sometimes', 'nullable', 'string', 'max:100'],
            'location' => ['sometimes', 'nullable', 'string', 'max:100'],
            'skills' => ['sometimes', 'nullable', 'array', 'max:10'],
            'skills.*' => ['string', 'max:50'],
            'ask_me_about' => ['sometimes', 'nullable', 'string', 'max:200'],
            'date_of_birth' => ['sometimes', 'nullable', 'date'],
            'joined_at' => ['sometimes', 'nullable', 'date'],
            'notification_settings' => ['sometimes', 'nullable', 'array'],
            'current_password' => ['sometimes', 'string'],
            'new_password' => ['sometimes', 'required_with:current_password', 'string', 'min:8', 'confirmed'],
        ]);

        if (isset($validated['new_password'])) {
            // If not forcing password change, require current password validation
            if (! $user->force_password_change) {
                if (! isset($validated['current_password']) || ! Hash::check($validated['current_password'], $user->password)) {
                    throw ValidationException::withMessages([
                        'current_password' => ['Current password is incorrect.'],
                    ]);
                }
            }
            $user->password = $validated['new_password'];
            // Clear the force_password_change flag after successful password change
            $user->force_password_change = false;
        }

        $profileData = collect($validated)
            ->except(['current_password', 'new_password', 'new_password_confirmation'])
            ->toArray();
        $profileData = $this->resolveDepartmentFields($profileData);

        $user->fill($profileData)->save();

        return response()->json($user->fresh()->load('department'));
    }
}
