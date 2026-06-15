<?php

namespace App\Support;

use App\Models\AccessGroup;
use App\Models\User;
use App\Models\UserSystemAccess;

class UserApplicationAccess
{
    /**
     * Resolve allowed public application slugs for a user.
     *
     * Returns null when the user may access all public applications (admin only).
     * Returns an array (possibly empty) when access is restricted.
     */
    public static function allowedPublicSlugs(User $user): ?array
    {
        if ($user->role === 'admin') {
            return null;
        }

        $groups = $user->relationLoaded('accessGroups')
            ? $user->accessGroups
            : $user->accessGroups()->with('allowedApplications')->get();

        if ($groups->isNotEmpty()) {
            $slugs = [];

            foreach ($groups as $group) {
                if (! $group->relationLoaded('allowedApplications')) {
                    $group->load('allowedApplications');
                }

                $slugs = array_merge($slugs, $group->allowedApplications->pluck('slug')->all());
            }

            return array_values(array_unique($slugs));
        }

        $accessRecord = UserSystemAccess::query()
            ->with('allowedApplications')
            ->where('user_email', $user->email)
            ->first();

        if ($accessRecord) {
            return $accessRecord->allowedApplications->pluck('slug')->values()->all();
        }

        return [];
    }

    /**
     * @param  array<int, mixed>|null  $slugs
     * @return array<int, string>
     */
    public static function normalizeSlugs(?array $slugs): array
    {
        return array_values(array_filter(
            (array) $slugs,
            fn ($slug) => is_string($slug) && $slug !== ''
        ));
    }
}
