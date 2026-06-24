<?php

namespace App\Models;

use App\Observers\NotificationObserver;
use Illuminate\Database\Eloquent\Attributes\ObservedBy;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[ObservedBy([NotificationObserver::class])]
class Notification extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'system_id',
        'type',
        'priority',
        'title',
        'message',
        'data',
        'category',
        'is_read',
        'read_at',
        'is_broadcast',
        'broadcast_id',
        'broadcast_starts_at',
        'broadcast_ends_at',
        'snoozed_until',
        'action_url',
        'delivery_channels',
    ];

    protected $appends = [
        'created_date',
        'updated_date',
    ];

    protected function casts(): array
    {
        return [
            'data' => 'array',
            'is_read' => 'boolean',
            'read_at' => 'datetime',
            'is_broadcast' => 'boolean',
            'broadcast_starts_at' => 'datetime',
            'broadcast_ends_at' => 'datetime',
            'snoozed_until' => 'datetime',
            'delivery_channels' => 'array',
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
