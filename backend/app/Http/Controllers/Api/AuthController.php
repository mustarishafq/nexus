<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\User;
use App\Support\ApiTokenAuth;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'full_name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
        ]);

        $user = User::create([
            'name' => $validated['full_name'],
            'full_name' => $validated['full_name'],
            'email' => $validated['email'],
            'password' => $validated['password'],
            'role' => 'user',
            'is_approved' => false,
        ]);

        return response()->json([
            'message' => 'Registration submitted. Wait for admin approval before login.',
            'user' => $user,
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::query()->where('email', $validated['email'])->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Invalid credentials.'],
            ]);
        }

        if (! $user->is_approved) {
            return response()->json([
                'message' => 'Your account is pending admin approval.',
                'code' => 'account_not_approved',
            ], 403);
        }

        $token = ApiTokenAuth::issueToken($user);

        ActivityLog::create([
            'user_id'     => (string) $user->id,
            'user_name'   => $user->full_name ?? $user->name ?? $user->email,
            'action'      => 'login',
            'description' => 'Logged in to '.config('app.name', 'Nexus'),
            'ip_address'  => $request->ip(),
        ]);

        return response()->json([
            'message' => 'Login successful.',
            'token' => $token,
            'user' => $user,
        ]);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $status = Password::sendResetLink([
            'email' => $validated['email'],
        ]);

        if ($status !== Password::RESET_LINK_SENT) {
            return response()->json([
                'message' => __($status),
            ], 422);
        }

        return response()->json([
            'message' => 'Reset link sent if the email exists.',
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if ($user) {
            ActivityLog::create([
                'user_id'     => (string) $user->id,
                'user_name'   => $user->full_name ?? $user->name ?? $user->email,
                'action'      => 'logout',
                'description' => 'Logged out of '.config('app.name', 'Nexus'),
                'ip_address'  => $request->ip(),
            ]);
            ApiTokenAuth::revoke($user);
        }

        return response()->json([
            'message' => 'Logged out.',
        ]);
    }
}
