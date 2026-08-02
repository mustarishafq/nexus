<?php

namespace App\Support;

use App\Models\User;
use App\Services\GamificationService;

class UserProfileSerializer
{
    /**
     * @var list<string>
     */
    public const PRIVATE_USER_ATTRIBUTES = [
        'full_name',
        'gender',
        'place_of_birth',
        'nationality',
        'religion',
        'race',
        'marital_status',
        'current_address',
        'home_phone',
        'ic_number',
        'epf_number',
        'socso_number',
        'income_tax_number',
        'emergency_contact_name',
        'emergency_contact_phone',
        'next_of_kin_relationship',
        'next_of_kin_ic_number',
        'next_of_kin_nationality',
        'next_of_kin_occupation',
        'next_of_kin_address',
        'spouse_details',
        'children',
        'employee_id',
        'employment_type',
        'personal_phone',
        'personal_phone_visible',
    ];

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
    public static function publicProfile(User $user, bool $includeRank = true): array
    {
        // Compute before stripping private fields so public viewers still see accurate strength.
        $completeness = ProfileCompleteness::forUser($user);

        $array = $user->makeHidden([
            'password',
            'remember_token',
            'notification_settings',
            'force_password_change',
            ...self::PRIVATE_USER_ATTRIBUTES,
        ])->toArray();

        $array['name'] = $user->displayName();
        $array['manager'] = self::managerSummary($user->relationLoaded('manager') ? $user->manager : $user->manager()->with('department')->first());
        $array['profile_completeness'] = $completeness;
        $array = array_merge($array, self::expDirectoryFields($user));
        if ($includeRank) {
            $array['rank'] = app(GamificationService::class)->resolveRank($user);
        }

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
        $completeness = ProfileCompleteness::forUser($user);

        $array = $user->makeHidden([
            'password',
            'remember_token',
            'notification_settings',
        ])->toArray();

        $array['manager'] = self::managerSummary($user->relationLoaded('manager') ? $user->manager : $user->manager()->with('department')->first());
        $array['feed_post_requires_approval'] = AppSettings::userRequiresFeedPostApproval($user);
        $array['profile_completeness'] = $completeness;
        $array = array_merge($array, self::expPublicFields($user));

        return $array;
    }

    /**
     * Lightweight EXP fields for directory cards (no rank query).
     *
     * @return array{exp_total: int, level: int}
     */
    public static function expDirectoryFields(User $user): array
    {
        $expTotal = (int) ($user->exp_total ?? 0);
        $progress = GamificationCatalog::levelProgress($expTotal);

        return [
            'exp_total' => $expTotal,
            'level' => $progress['level'],
        ];
    }

    /**
     * @return array{exp_total: int, level: int, rank: int|null}
     */
    private static function expPublicFields(User $user): array
    {
        return array_merge(self::expDirectoryFields($user), [
            'rank' => app(GamificationService::class)->resolveRank($user),
        ]);
    }
}
