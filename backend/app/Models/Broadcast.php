<?php

namespace App\Models;

use App\Casts\AppTimezoneDateTime;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Broadcast extends Model
{
    public const AUDIENCE_ALL = 'all';

    public const AUDIENCE_DEPARTMENT = 'department';

    public const AUDIENCE_INDIVIDUAL = 'individual';

    protected $fillable = [
        'title',
        'message',
        'priority',
        'audience_type',
        'broadcast_starts_at',
        'broadcast_ends_at',
    ];

    protected $appends = [
        'created_date',
        'updated_date',
        'user_ids',
        'department_ids',
    ];

    protected function casts(): array
    {
        return [
            'broadcast_starts_at' => AppTimezoneDateTime::class,
            'broadcast_ends_at' => AppTimezoneDateTime::class,
        ];
    }

    public function assignedUsers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'broadcast_users')->withTimestamps();
    }

    public function assignedDepartments(): BelongsToMany
    {
        return $this->belongsToMany(Department::class, 'broadcast_departments')->withTimestamps();
    }

    /**
     * @return array<int, int>
     */
    public function assignedUserIdList(): array
    {
        if (! $this->relationLoaded('assignedUsers')) {
            return [];
        }

        return $this->assignedUsers->pluck('id')->map(fn ($id) => (int) $id)->values()->all();
    }

    /**
     * @return array<int, int>
     */
    public function assignedDepartmentIdList(): array
    {
        if (! $this->relationLoaded('assignedDepartments')) {
            return [];
        }

        return $this->assignedDepartments->pluck('id')->map(fn ($id) => (int) $id)->values()->all();
    }

    public function getUserIdsAttribute(): array
    {
        return $this->assignedUserIdList();
    }

    public function getDepartmentIdsAttribute(): array
    {
        return $this->assignedDepartmentIdList();
    }

    public function getCreatedDateAttribute(): ?string
    {
        return $this->created_at ? $this->created_at->toISOString() : null;
    }

    public function getUpdatedDateAttribute(): ?string
    {
        return $this->updated_at ? $this->updated_at->toISOString() : null;
    }
}
