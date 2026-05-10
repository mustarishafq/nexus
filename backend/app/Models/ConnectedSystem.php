<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConnectedSystem extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'description',
        'base_url',
        'icon_url',
        'status',
        'api_key',
        'auth_mode',
        'visibility',
        'created_by_user_id',
        'private_allowed_user_emails',
        'is_enabled',
        'last_heartbeat',
        'notification_config',
        'color',
    ];

    protected $appends = [
        'created_date',
        'updated_date',
        'created_by_credit',
    ];

    protected function casts(): array
    {
        return [
            'is_enabled' => 'boolean',
            'last_heartbeat' => 'datetime',
            'notification_config' => 'array',
            'private_allowed_user_emails' => 'array',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function getCreatedDateAttribute(): ?string
    {
        return $this->created_at ? $this->created_at->toISOString() : null;
    }

    public function getUpdatedDateAttribute(): ?string
    {
        return $this->updated_at ? $this->updated_at->toISOString() : null;
    }

    public function getCreatedByCreditAttribute(): ?string
    {
        if (! $this->relationLoaded('creator')) {
            $this->loadMissing('creator');
        }

        if (! $this->creator) {
            return null;
        }

        return $this->creator->full_name ?: $this->creator->name ?: $this->creator->email;
    }
}
