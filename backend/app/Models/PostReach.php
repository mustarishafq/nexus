<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PostReach extends Model
{
    protected $fillable = [
        'post_id',
        'user_id',
        'reached_at',
    ];

    protected $casts = [
        'reached_at' => 'datetime',
    ];

    protected $appends = [
        'created_date',
    ];

    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function getCreatedDateAttribute(): ?string
    {
        return $this->reached_at?->toISOString() ?? $this->created_at?->toISOString();
    }
}
