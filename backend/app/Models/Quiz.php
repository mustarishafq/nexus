<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Quiz extends Model
{
    public const STATUS_DRAFT = 'draft';

    public const STATUS_PUBLISHED = 'published';

    protected $fillable = [
        'user_id',
        'title',
        'description',
        'status',
        'bgm_theme',
        'sfx_pack',
    ];

    public const BGM_THEMES = ['party', 'arcade', 'chill', 'energy'];

    public const SFX_PACKS = ['classic', 'chippy', 'soft', 'carnival'];

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function questions(): HasMany
    {
        return $this->hasMany(QuizQuestion::class)->orderBy('sort_order')->orderBy('id');
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(QuizSession::class);
    }
}
