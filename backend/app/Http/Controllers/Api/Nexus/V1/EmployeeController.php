<?php

namespace App\Http\Controllers\Api\Nexus\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\EmployeeSyncApplyService;
use App\Support\EmployeeSyncGuard;
use App\Support\EmployeeSyncSerializer;
use App\Support\NexusSatelliteAuth;
use App\Support\UserRoles;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class EmployeeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $auth = NexusSatelliteAuth::authenticate($request, ['brain-employees']);
        if ($auth instanceof JsonResponse) {
            return $auth;
        }

        $employees = User::query()
            ->withTrashed()
            ->with([
                'department:id,name',
                'company:id,name',
                'manager:id,name,full_name,job_title,profile_picture',
                'educations',
                'workExperiences',
                'userSkills',
            ])
            ->orderBy('id')
            ->get()
            ->map(fn (User $user) => EmployeeSyncSerializer::serialize($user))
            ->values();

        return response()->json(['employees' => $employees]);
    }

    public function update(Request $request): JsonResponse
    {
        $auth = NexusSatelliteAuth::authenticate($request, ['brain-employees']);
        if ($auth instanceof JsonResponse) {
            return $auth;
        }

        $request->validate([
            'employees' => ['required', 'array', 'min:1'],
            'employees.*' => ['required', 'array'],
            'employees.*.email' => ['required', 'email'],
            'employees.*.nexus_user_id' => ['sometimes', 'nullable', 'string', 'max:64'],
        ]);

        $employees = $request->input('employees', []);
        if (! is_array($employees)) {
            $employees = [];
        }

        $stats = EmployeeSyncGuard::runWithoutPush(
            fn () => app(EmployeeSyncApplyService::class)->apply($employees)
        );

        return response()->json([
            'message' => 'Employee sync applied',
            'stats' => $stats,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $auth = NexusSatelliteAuth::authenticate($request, ['brain-employees']);
        if ($auth instanceof JsonResponse) {
            return $auth;
        }

        $validated = $request->validate([
            'full_name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'role' => ['sometimes', 'string', Rule::in(UserRoles::ALL)],
            'employee_id' => ['sometimes', 'nullable', 'string', 'max:64'],
            'job_title' => ['sometimes', 'nullable', 'string', 'max:255'],
            'employment_type' => ['sometimes', 'nullable', 'string', 'max:64'],
            'joined_at' => ['sometimes', 'nullable', 'date'],
            'is_approved' => ['sometimes', 'boolean'],
        ]);

        $email = strtolower(trim($validated['email']));
        $existing = User::withTrashed()->where('email', $email)->first();

        if ($existing) {
            if ($existing->trashed()) {
                $existing->restore();
            }

            $existing->forceFill([
                'full_name' => $validated['full_name'],
                'name' => $existing->name ?: '',
                'role' => $validated['role'] ?? $existing->role ?? UserRoles::USER,
                'is_approved' => $validated['is_approved'] ?? true,
                'employee_id' => $validated['employee_id'] ?? $existing->employee_id,
                'job_title' => $validated['job_title'] ?? $existing->job_title,
                'employment_type' => $validated['employment_type'] ?? $existing->employment_type,
                'joined_at' => $validated['joined_at'] ?? $existing->joined_at,
            ])->save();

            $existing->load([
                'department:id,name',
                'company:id,name',
                'manager:id,name,full_name,job_title,profile_picture',
                'educations',
                'workExperiences',
                'userSkills',
            ]);

            return response()->json([
                'created' => false,
                'temporary_password' => null,
                'employee' => EmployeeSyncSerializer::serialize($existing),
            ]);
        }

        $temporaryPassword = Str::password(16);
        $user = User::create([
            'name' => '',
            'full_name' => $validated['full_name'],
            'email' => $email,
            'password' => Hash::make($temporaryPassword),
            'role' => $validated['role'] ?? UserRoles::USER,
            'is_approved' => $validated['is_approved'] ?? true,
            'force_password_change' => true,
            'employee_id' => $validated['employee_id'] ?? null,
            'job_title' => $validated['job_title'] ?? null,
            'employment_type' => $validated['employment_type'] ?? null,
            'joined_at' => $validated['joined_at'] ?? null,
        ]);

        $user->load([
            'department:id,name',
            'company:id,name',
            'manager:id,name,full_name,job_title,profile_picture',
            'educations',
            'workExperiences',
            'userSkills',
        ]);

        return response()->json([
            'created' => true,
            'temporary_password' => $temporaryPassword,
            'employee' => EmployeeSyncSerializer::serialize($user),
        ], 201);
    }
}
