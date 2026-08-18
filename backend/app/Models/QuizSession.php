<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class QuizSession extends Model
{
    public const MODE_LIVE = 'live';

    public const MODE_ASYNC = 'async';

    public const STATUS_LOBBY = 'lobby';

    public const STATUS_QUESTION = 'question';

    public const STATUS_REVEAL = 'reveal';

    public const STATUS_LEADERBOARD = 'leaderboard';

    public const STATUS_FINISHED = 'finished';

    protected $fillable = [
        'quiz_id',
        'host_user_id',
        'mode',
        'pin',
        'join_token',
        'status',
        'current_question_id',
        'question_started_at',
        'music_enabled',
        'bgm_theme',
        'sfx_pack',
    ];

    protected function casts(): array
    {
        return [
            'question_started_at' => 'datetime',
            'music_enabled' => 'boolean',
        ];
    }

    public function quiz(): BelongsTo
    {
        return $this->belongsTo(Quiz::class);
    }

    public function host(): BelongsTo
    {
        return $this->belongsTo(User::class, 'host_user_id');
    }

    public function currentQuestion(): BelongsTo
    {
        return $this->belongsTo(QuizQuestion::class, 'current_question_id');
    }

    public function players(): HasMany
    {
        return $this->hasMany(QuizSessionPlayer::class)->orderByDesc('score')->orderBy('joined_at');
    }

    public function answers(): HasMany
    {
        return $this->hasMany(QuizSessionAnswer::class);
    }

    public function powerUps(): HasMany
    {
        return $this->hasMany(QuizSessionPowerUp::class);
    }

    public function isOpenForJoin(): bool
    {
        return $this->mode === self::MODE_LIVE
            && in_array($this->status, [self::STATUS_LOBBY, self::STATUS_QUESTION, self::STATUS_REVEAL, self::STATUS_LEADERBOARD], true);
    }
}
