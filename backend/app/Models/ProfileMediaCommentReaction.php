<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProfileMediaCommentReaction extends Model
{
    protected $fillable = [
        'profile_media_comment_id',
        'user_id',
        'reaction',
    ];

    protected $appends = [
        'created_date',
    ];

    public function comment(): BelongsTo
    {
        return $this->belongsTo(ProfileMediaComment::class, 'profile_media_comment_id');
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
