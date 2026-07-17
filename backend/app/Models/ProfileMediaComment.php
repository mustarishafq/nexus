<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProfileMediaComment extends Model
{
    protected $fillable = [
        'owner_user_id',
        'media_type',
        'author_user_id',
        'parent_comment_id',
        'body',
    ];

    protected $appends = [
        'created_date',
    ];

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_user_id');
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_comment_id');
    }

    public function replies(): HasMany
    {
        return $this->hasMany(self::class, 'parent_comment_id');
    }

    public function reactions(): HasMany
    {
        return $this->hasMany(ProfileMediaCommentReaction::class);
    }

    public function getCreatedDateAttribute(): ?string
    {
        return $this->created_at?->toISOString();
    }
}
