<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class MetabaseDashboard extends Model
{
    public const ASSIGNMENT_GROUP = 'group';

    public const ASSIGNMENT_INDIVIDUAL = 'individual';

    protected $fillable = [
        'name',
        'public_url',
        'assignment_type',
        'owner_user_id',
        'category',
        'is_enabled',
        'sort_order',
    ];

    protected $appends = [
        'created_date',
        'updated_date',
        'access_group_ids',
        'user_ids',
    ];

    protected function casts(): array
    {
        return [
            'is_enabled' => 'boolean',
            'sort_order' => 'integer',
            'owner_user_id' => 'integer',
        ];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    public function assignedAccessGroups(): BelongsToMany
    {
        return $this->belongsToMany(AccessGroup::class, 'metabase_dashboard_access_groups')->withTimestamps();
    }

    public function assignedUsers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'metabase_dashboard_users')->withTimestamps();
    }

    /**
     * @return array<int, int>
     */
    public function accessGroupIdList(): array
    {
        if (! $this->relationLoaded('assignedAccessGroups')) {
            return [];
        }

        return $this->assignedAccessGroups->pluck('id')->map(fn ($id) => (int) $id)->values()->all();
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

    public function getAccessGroupIdsAttribute(): array
    {
        return $this->accessGroupIdList();
    }

    public function getUserIdsAttribute(): array
    {
        return $this->assignedUserIdList();
    }

    public function getCreatedDateAttribute(): ?string
    {
        return $this->created_at?->toISOString();
    }

    public function getUpdatedDateAttribute(): ?string
    {
        return $this->updated_at?->toISOString();
    }
}
