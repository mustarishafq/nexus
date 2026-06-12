<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MetabaseDashboard extends Model
{
    public const ASSIGNMENT_GROUP = 'group';

    public const ASSIGNMENT_INDIVIDUAL = 'individual';

    protected $fillable = [
        'name',
        'public_url',
        'assignment_type',
        'access_group_ids',
        'user_ids',
        'owner_user_id',
        'category',
        'is_enabled',
        'sort_order',
    ];

    protected $appends = [
        'created_date',
        'updated_date',
    ];

    protected function casts(): array
    {
        return [
            'access_group_ids' => 'array',
            'user_ids' => 'array',
            'is_enabled' => 'boolean',
            'sort_order' => 'integer',
            'owner_user_id' => 'integer',
        ];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_user_id');
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
