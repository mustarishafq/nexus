<?php

namespace App\Support;

use App\Models\Broadcast;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

class BroadcastAudience
{
    /**
     * @return Collection<int, int>
     */
    public static function eligibleUserIds(Broadcast $broadcast): Collection
    {
        if ($broadcast->audience_type === Broadcast::AUDIENCE_ALL) {
            return User::query()
                ->where('is_approved', true)
                ->pluck('id')
                ->map(fn ($id) => (int) $id);
        }

        if ($broadcast->audience_type === Broadcast::AUDIENCE_INDIVIDUAL) {
            $broadcast->loadMissing('assignedUsers');

            return $broadcast->assignedUsers
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->values();
        }

        $broadcast->loadMissing('assignedDepartments');
        $departmentIds = $broadcast->assignedDepartments->pluck('id')->all();

        if ($departmentIds === []) {
            return collect();
        }

        return User::query()
            ->where('is_approved', true)
            ->whereIn('department_id', $departmentIds)
            ->pluck('id')
            ->map(fn ($id) => (int) $id);
    }

    public static function isVisibleToUser(Broadcast $broadcast, User $user): bool
    {
        if (! $user->is_approved) {
            return false;
        }

        if ($broadcast->audience_type === Broadcast::AUDIENCE_ALL) {
            return true;
        }

        if ($broadcast->audience_type === Broadcast::AUDIENCE_INDIVIDUAL) {
            $broadcast->loadMissing('assignedUsers');

            return in_array((int) $user->id, $broadcast->assignedUserIdList(), true);
        }

        if ($user->department_id === null) {
            return false;
        }

        $broadcast->loadMissing('assignedDepartments');

        return in_array((int) $user->department_id, $broadcast->assignedDepartmentIdList(), true);
    }

    public static function scopeVisibleToUser(Builder $query, User $user): Builder
    {
        return $query->where(function (Builder $outer) use ($user) {
            $outer->where('audience_type', Broadcast::AUDIENCE_ALL)
                ->orWhere(function (Builder $inner) use ($user) {
                    $inner->where('audience_type', Broadcast::AUDIENCE_INDIVIDUAL)
                        ->whereHas('assignedUsers', fn (Builder $assigned) => $assigned->where('users.id', $user->id));
                });

            if ($user->department_id !== null) {
                $outer->orWhere(function (Builder $inner) use ($user) {
                    $inner->where('audience_type', Broadcast::AUDIENCE_DEPARTMENT)
                        ->whereHas('assignedDepartments', fn (Builder $assigned) => $assigned->where('departments.id', $user->department_id));
                });
            }
        });
    }
}
