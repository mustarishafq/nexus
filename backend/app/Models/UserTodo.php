<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserTodo extends Model
{
    public const SOURCE_NOTIFICATION = 'notification';

    public const SOURCE_CALENDAR_EVENT = 'calendar_event';

    public const SOURCE_MANUAL = 'manual';

    protected $fillable = [
        'user_id',
        'notification_id',
        'calendar_event_id',
        'source_type',
        'title',
        'message',
        'action_url',
        'system_id',
        'category',
        'type',
        'completed_at',
    ];

    protected $appends = [
        'created_date',
        'updated_date',
    ];

    protected function casts(): array
    {
        return [
            'completed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function notification(): BelongsTo
    {
        return $this->belongsTo(Notification::class);
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
