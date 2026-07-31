<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PostPollOption extends Model
{
    protected $fillable = [
        'post_poll_id',
        'label',
        'sort_order',
    ];

    public function poll(): BelongsTo
    {
        return $this->belongsTo(PostPoll::class, 'post_poll_id');
    }

    public function votes(): HasMany
    {
        return $this->hasMany(PostPollVote::class);
    }
}
