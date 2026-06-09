<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MetabaseDashboard extends Model
{
    protected $fillable = [
        'name',
        'public_url',
        'access_group_ids',
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
            'is_enabled' => 'boolean',
            'sort_order' => 'integer',
        ];
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
