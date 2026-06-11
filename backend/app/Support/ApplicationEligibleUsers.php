<?php

namespace App\Support;

use App\Models\AccessGroup;
use App\Models\Application;
use App\Models\User;
use App\Models\UserSystemAccess;
use Illuminate\Support\Collection;

class ApplicationEligibleUsers
{
    /**
     * Approved users who can access the given application.
     *
     * @return Collection<int, User>
     */
    public static function forApplication(Application $application): Collection
    {
        if ($application->visibility === 'private') {
            return self::privateApplicationUsers($application);
        }

        return self::publicApplicationUsers($application->slug);
    }

    /**
     * Unique approved users eligible for at least one application in the set.
     *
     * @param  Collection<int, Application>  $applications
     * @return Collection<int, User>
     */
    public static function forApplications(Collection $applications): Collection
    {
        $usersById = collect();

        foreach ($applications as $application) {
            foreach (self::forApplication($application) as $user) {
                $usersById->put($user->id, $user);
            }
        }

        return $usersById
            ->values()
            ->sortBy(fn (User $user) => strtolower($user->full_name ?: $user->name ?: $user->email ?: ''))
            ->values();
    }

    /**
     * @return Collection<int, User>
     */
    private static function privateApplicationUsers(Application $application): Collection
    {
        $emails = array_values(array_filter(
            (array) $application->private_allowed_user_emails,
            fn ($email) => is_string($email) && $email !== ''
        ));

        return User::query()
            ->where('is_approved', true)
            ->where(function ($query) use ($application, $emails) {
                if ($application->created_by_user_id) {
                    $query->where('id', $application->created_by_user_id);
                }

                if ($emails !== []) {
                    $query->orWhereIn('email', $emails);
                }
            })
            ->orderBy('full_name')
            ->orderBy('email')
            ->get(['id', 'full_name', 'name', 'email', 'profile_picture']);
    }

    /**
     * @return Collection<int, User>
     */
    private static function publicApplicationUsers(string $slug): Collection
    {
        $userIds = collect();

        $matchingGroupIds = AccessGroup::query()
            ->get(['id', 'allowed_system_slugs'])
            ->filter(function (AccessGroup $group) use ($slug) {
                return in_array($slug, UserApplicationAccess::normalizeSlugs($group->allowed_system_slugs), true);
            })
            ->pluck('id');

        if ($matchingGroupIds->isNotEmpty()) {
            $groupUserIds = User::query()
                ->where('is_approved', true)
                ->whereHas('accessGroups', fn ($query) => $query->whereIn('access_groups.id', $matchingGroupIds))
                ->pluck('id');

            $userIds = $userIds->merge($groupUserIds);
        }

        $accessEmails = UserSystemAccess::query()
            ->get(['user_email', 'allowed_system_slugs'])
            ->filter(function (UserSystemAccess $record) use ($slug) {
                return in_array($slug, UserApplicationAccess::normalizeSlugs($record->allowed_system_slugs), true);
            })
            ->pluck('user_email')
            ->filter(fn ($email) => is_string($email) && $email !== '')
            ->values();

        if ($accessEmails->isNotEmpty()) {
            $legacyUserIds = User::query()
                ->where('is_approved', true)
                ->whereIn('email', $accessEmails->all())
                ->pluck('id');

            $userIds = $userIds->merge($legacyUserIds);
        }

        $adminIds = User::query()
            ->where('is_approved', true)
            ->where('role', 'admin')
            ->pluck('id');

        $userIds = $userIds->merge($adminIds)->unique()->values();

        if ($userIds->isEmpty()) {
            return collect();
        }

        return User::query()
            ->whereIn('id', $userIds)
            ->where('is_approved', true)
            ->orderBy('full_name')
            ->orderBy('email')
            ->get(['id', 'full_name', 'name', 'email', 'profile_picture']);
    }
}
