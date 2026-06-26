<?php

namespace App\Support;

use App\Models\AccessGroup;
use App\Models\Application;
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
     * @return array<int, string>
     */
    public static function normalizeSlugs(?array $slugs): array
    {
        return array_values(array_filter(
            (array) $slugs,
            fn ($slug) => is_string($slug) && $slug !== ''
        ));
    }

    public static function canAccess(User $user, Application $application): bool
    {
        if ($user->role === 'admin') {
            return true;
        }

        if ($application->visibility === 'public') {
            $allowedPublicSlugs = self::allowedPublicSlugs($user);

            return $allowedPublicSlugs === null || in_array($application->slug, $allowedPublicSlugs, true);
        }

        if (! $application->relationLoaded('privateAccessEmails')) {
            $application->load('privateAccessEmails');
        }

        return (int) $application->created_by_user_id === (int) $user->id
            || $application->privateAccessEmails->contains('email', $user->email);
    }

    /**
     * @return \Illuminate\Database\Eloquent\Builder<\App\Models\Application>
     */
    public static function mcpEnabledQuery(): \Illuminate\Database\Eloquent\Builder
    {
        return Application::query()
            ->where('is_enabled', true)
            ->where('mcp_enabled', true)
            ->with('privateAccessEmails');
    }

    /**
     * @return \Illuminate\Database\Eloquent\Builder<\App\Models\Application>
     */
    public static function accessibleMcpApplicationsQuery(User $user): \Illuminate\Database\Eloquent\Builder
    {
        $query = self::mcpEnabledQuery();

        if ($user->role === 'admin') {
            return $query;
        }

        $allowedPublicSlugs = self::allowedPublicSlugs($user);

        return $query->where(function ($systems) use ($user, $allowedPublicSlugs) {
            $systems->where(function ($publicSystems) use ($allowedPublicSlugs) {
                $publicSystems->where('visibility', 'public');
                if ($allowedPublicSlugs !== null) {
                    if (count($allowedPublicSlugs) === 0) {
                        $publicSystems->whereRaw('1 = 0');
                    } else {
                        $publicSystems->whereIn('slug', $allowedPublicSlugs);
                    }
                }
            })->orWhere(function ($privateSystems) use ($user) {
                $privateSystems
                    ->where('visibility', 'private')
                    ->where(function ($privateAccess) use ($user) {
                        $privateAccess
                            ->where('created_by_user_id', $user->id)
                            ->orWhereHas('privateAccessEmails', fn ($emailQuery) => $emailQuery->where('email', $user->email));
                    });
            });
        });
    }

    public static function findMcpApplicationForUser(User $user, string $slug): Application
    {
        $application = self::mcpEnabledQuery()->where('slug', $slug)->first();

        if (! $application) {
            throw new \RuntimeException("No enabled application found for slug \"{$slug}\".");
        }

        if (! self::canAccess($user, $application)) {
            throw new \RuntimeException("You don't have access to \"{$slug}\".");
        }

        return $application;
    }
}
