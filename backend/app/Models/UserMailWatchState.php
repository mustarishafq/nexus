<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserMailWatchState extends Model
{
    protected $fillable = [
        'user_id',
        'seen_uids',
        'initialized_at',
        'last_checked_at',
    ];

    protected function casts(): array
    {
        return [
            'seen_uids' => 'array',
            'initialized_at' => 'datetime',
            'last_checked_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
