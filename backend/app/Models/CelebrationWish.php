<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CelebrationWish extends Model
{
    protected $fillable = [
        'recipient_user_id',
        'sender_user_id',
        'celebration_type',
        'celebration_date',
        'reaction',
        'message',
    ];

    protected $appends = [
        'created_date',
    ];

    protected function casts(): array
    {
        return [
            'celebration_date' => 'date',
        ];
    }

    public function recipient(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recipient_user_id');
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_user_id');
    }

    public function getCreatedDateAttribute(): ?string
    {
        return $this->created_at?->toISOString();
    }
}
