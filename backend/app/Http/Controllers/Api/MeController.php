<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\ApiTokenAuth;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class MeController extends Controller
{
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

        return response()->json($user);
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
            'notification_settings' => ['sometimes', 'nullable', 'array'],
            'current_password' => ['sometimes', 'required_with:new_password', 'string'],
            'new_password' => ['sometimes', 'required_with:current_password', 'string', 'min:8', 'confirmed'],
        ]);

        if (isset($validated['new_password'])) {
            if (! Hash::check($validated['current_password'], $user->password)) {
                throw ValidationException::withMessages([
                    'current_password' => ['Current password is incorrect.'],
                ]);
            }
            $user->password = $validated['new_password'];
        }

        $user->fill(collect($validated)->except(['current_password', 'new_password', 'new_password_confirmation'])->toArray())->save();

        return response()->json($user->fresh());
    }
}
