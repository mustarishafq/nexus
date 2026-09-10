<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MessageReaction extends Model
{
    protected $fillable = [
        'message_id',
        'user_id',
        'reaction',
    ];

    protected $appends = [
        'created_date',
    ];

    public function message(): BelongsTo
    {
        return $this->belongsTo(Message::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function getCreatedDateAttribute(): ?string
    {
        return $this->created_at?->toISOString();
    }
}
