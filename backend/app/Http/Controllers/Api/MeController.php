<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ResolvesDepartmentInput;
use App\Http\Controllers\Api\Concerns\ValidatesHrProfileFields;
use App\Http\Controllers\Controller;
use App\Support\ApiTokenAuth;
use App\Support\SyncUserProfileRecords;
use App\Support\UserProfileSerializer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class MeController extends Controller
{
    use ResolvesDepartmentInput;
    use ValidatesHrProfileFields;

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

        return response()->json(UserProfileSerializer::privateProfile($this->loadProfile($user)));
    }

    /**
     * @return array<int, string>
     */
    private function profileRelations(): array
    {
        return ['department', 'manager.department', 'educations', 'workExperiences', 'userSkills'];
    }

    private function loadProfile($user)
    {
        return $user->load($this->profileRelations());
    }

    public function update(Request $request): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validated = $request->validate(array_merge([
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
            'work_phone' => ['sometimes', 'nullable', 'string', 'max:30'],
            'personal_phone' => ['sometimes', 'nullable', 'string', 'max:30'],
            'personal_phone_visible' => ['sometimes', 'boolean'],
            'emergency_contact_name' => ['sometimes', 'nullable', 'string', 'max:150'],
            'emergency_contact_phone' => ['sometimes', 'nullable', 'string', 'max:30'],
            'gender' => ['sometimes', 'nullable', 'string', 'max:30'],
            'education_history' => ['sometimes', 'nullable', 'array', 'max:10'],
            'education_history.*.institution' => ['required_with:education_history', 'string', 'max:150'],
            'education_history.*.qualification' => ['sometimes', 'nullable', 'string', 'max:150'],
            'education_history.*.field_of_study' => ['sometimes', 'nullable', 'string', 'max:150'],
            'education_history.*.year_from' => ['sometimes', 'nullable', 'string', 'max:10'],
            'education_history.*.year_to' => ['sometimes', 'nullable', 'string', 'max:10'],
            'work_history' => ['sometimes', 'nullable', 'array', 'max:15'],
            'work_history.*.company' => ['required_with:work_history', 'string', 'max:150'],
            'work_history.*.job_title' => ['sometimes', 'nullable', 'string', 'max:150'],
            'work_history.*.date_from' => ['sometimes', 'nullable', 'string', 'max:20'],
            'work_history.*.date_to' => ['sometimes', 'nullable', 'string', 'max:20'],
            'work_history.*.description' => ['sometimes', 'nullable', 'string', 'max:500'],
            'notification_settings' => ['sometimes', 'nullable', 'array'],
            'current_password' => ['sometimes', 'string'],
            'new_password' => ['sometimes', 'required_with:current_password', 'string', 'min:8', 'confirmed'],
        ], $this->hrProfileValidationRules()));

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
            ->except([
                'current_password',
                'new_password',
                'new_password_confirmation',
                'education_history',
                'work_history',
                'skills',
            ])
            ->toArray();
        $profileData = $this->normalizeHrProfilePayload($profileData);
        $profileData = $this->resolveDepartmentFields($profileData);

        $user->fill($profileData)->save();

        if (array_key_exists('education_history', $validated)) {
            SyncUserProfileRecords::syncEducations($user, $validated['education_history']);
        }

        if (array_key_exists('work_history', $validated)) {
            SyncUserProfileRecords::syncWorkExperiences($user, $validated['work_history']);
        }

        if (array_key_exists('skills', $validated)) {
            SyncUserProfileRecords::syncSkills($user, $validated['skills']);
        }

        return response()->json(UserProfileSerializer::privateProfile($this->loadProfile($user->fresh())));
    }
}
