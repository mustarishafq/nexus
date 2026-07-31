<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PostPollVote extends Model
{
    protected $fillable = [
        'post_poll_id',
        'post_poll_option_id',
        'user_id',
    ];

    public function poll(): BelongsTo
    {
        return $this->belongsTo(PostPoll::class, 'post_poll_id');
    }

    public function option(): BelongsTo
    {
        return $this->belongsTo(PostPollOption::class, 'post_poll_option_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
