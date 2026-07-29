<?php

namespace App\Support;

use App\Models\User;

class EmployeeSyncSerializer
{
    /**
     * @return array<string, mixed>
     */
    public static function serialize(User $user): array
    {
        $user->loadMissing([
            'department:id,name',
            'company:id,name',
            'manager:id,name,full_name,job_title,profile_picture',
            'educations',
            'workExperiences',
            'userSkills',
        ]);

        $manager = $user->manager;

        return [
            'nexus_user_id' => (string) $user->id,
            'email' => $user->email,
            'name' => $user->name ?: $user->full_name,
            'full_name' => $user->full_name ?: $user->name,
            'role' => $user->role ?? UserRoles::USER,
            'is_approved' => (bool) $user->is_approved,
            'inactive' => ! (bool) $user->is_approved,
            'deleted' => $user->trashed(),
            'profile_picture' => $user->profile_picture,
            'cover_picture' => $user->cover_picture,
            'bio' => $user->bio,
            'location' => $user->location,
            'ask_me_about' => $user->ask_me_about,
            'employee_id' => $user->employee_id,
            'job_title' => $user->job_title,
            'employment_type' => $user->employment_type,
            'joined_at' => $user->joined_at?->toDateString(),
            'date_of_birth' => $user->date_of_birth?->toDateString(),
            'department_name' => $user->department?->name,
            'company_name' => $user->company?->name,
            'manager_nexus_user_id' => $user->manager_id ? (string) $user->manager_id : null,
            'manager' => $manager ? [
                'nexus_user_id' => (string) $manager->id,
                'name' => $manager->displayName(),
                'job_title' => $manager->job_title,
                'profile_picture' => $manager->profile_picture,
            ] : null,
            'work_phone' => $user->work_phone,
            'personal_phone' => $user->personal_phone,
            'personal_phone_visible' => (bool) $user->personal_phone_visible,
            'home_phone' => $user->home_phone,
            'emergency_contact_name' => $user->emergency_contact_name,
            'emergency_contact_phone' => $user->emergency_contact_phone,
            'next_of_kin_relationship' => $user->next_of_kin_relationship,
            'next_of_kin_ic_number' => $user->next_of_kin_ic_number,
            'next_of_kin_nationality' => $user->next_of_kin_nationality,
            'next_of_kin_occupation' => $user->next_of_kin_occupation,
            'next_of_kin_address' => $user->next_of_kin_address,
            'spouse_details' => $user->spouse_details,
            'children' => $user->children,
            'gender' => $user->gender,
            'place_of_birth' => $user->place_of_birth,
            'nationality' => $user->nationality,
            'religion' => $user->religion,
            'race' => $user->race,
            'marital_status' => $user->marital_status,
            'current_address' => $user->current_address,
            'ic_number' => $user->ic_number,
            'epf_number' => $user->epf_number,
            'socso_number' => $user->socso_number,
            'income_tax_number' => $user->income_tax_number,
            'skills' => $user->skillsList(),
            'education_history' => $user->educationHistoryList(),
            'work_history' => $user->workHistoryList(),
        ];
    }
}
