<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PostEdit extends Model
{
    protected $fillable = [
        'post_id',
        'editor_user_id',
        'body',
    ];

    protected $appends = [
        'created_date',
    ];

    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class);
    }

    public function editor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'editor_user_id');
    }

    public function getCreatedDateAttribute(): ?string
    {
        return $this->created_at?->toISOString();
    }
}
