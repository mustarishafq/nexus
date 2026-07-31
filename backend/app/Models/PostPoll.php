<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PostPoll extends Model
{
    public const MIN_OPTIONS = 2;

    public const MAX_OPTIONS = 6;

    public const ABSOLUTE_MAX_OPTIONS = 12;

    public const MAX_OPTION_LENGTH = 120;

    public const MAX_PER_POST = 3;

    protected $fillable = [
        'post_id',
        'sort_order',
        'allow_multiple',
        'allow_add_options',
    ];

    protected $casts = [
        'allow_multiple' => 'boolean',
        'allow_add_options' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class);
    }

    public function options(): HasMany
    {
        return $this->hasMany(PostPollOption::class)->orderBy('sort_order')->orderBy('id');
    }

    public function votes(): HasMany
    {
        return $this->hasMany(PostPollVote::class);
    }
}
