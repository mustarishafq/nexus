<?php

namespace App\Support;

use App\Models\User;

class UserProfileSerializer
{
    /**
     * @return array<string, mixed>
     */
    public static function managerSummary(?User $manager): ?array
    {
        if (! $manager) {
            return null;
        }

        return [
            'id' => $manager->id,
            'name' => $manager->displayName(),
            'profile_picture' => $manager->profile_picture,
            'job_title' => $manager->job_title,
            'department' => $manager->department?->name,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function orgChartNode(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->displayName(),
            'profile_picture' => $user->profile_picture,
            'job_title' => $user->job_title,
            'department_id' => $user->department_id,
            'department' => $user->department?->name,
            'manager_id' => $user->manager_id,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function publicProfile(User $user): array
    {
        $array = $user->makeHidden([
            'password',
            'remember_token',
            'notification_settings',
            'force_password_change',
            'full_name',
            'emergency_contact_name',
            'emergency_contact_phone',
            'gender',
            'employee_id',
            'employment_type',
            'personal_phone',
            'personal_phone_visible',
        ])->toArray();

        $array['name'] = $user->displayName();
        $array['manager'] = self::managerSummary($user->relationLoaded('manager') ? $user->manager : $user->manager()->with('department')->first());

        if ($user->personal_phone_visible) {
            $array['personal_phone'] = $user->personal_phone;
        }

        return $array;
    }

    /**
     * @return array<string, mixed>
     */
    public static function privateProfile(User $user): array
    {
        $array = $user->makeHidden([
            'password',
            'remember_token',
            'notification_settings',
            'force_password_change',
        ])->toArray();

        $array['manager'] = self::managerSummary($user->relationLoaded('manager') ? $user->manager : $user->manager()->with('department')->first());

        return $array;
    }
}
