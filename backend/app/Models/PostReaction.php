<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PostReaction extends Model
{
    protected $fillable = [
        'post_id',
        'user_id',
        'reaction',
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
        return $this->created_at?->toISOString();
    }
}
