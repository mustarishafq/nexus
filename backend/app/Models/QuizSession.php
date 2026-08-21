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
        'is_preview',
        'pin',
        'join_token',
        'status',
        'current_question_id',
        'question_started_at',
        'question_ends_at',
        'phase_ends_at',
        'music_enabled',
        'bgm_theme',
        'sfx_pack',
        'host_last_seen_at',
        'paused_at',
        'pause_remaining_ms',
        'finished_at',
    ];

    protected function casts(): array
    {
        return [
            'question_started_at' => 'datetime',
            'question_ends_at' => 'datetime',
            'phase_ends_at' => 'datetime',
            'host_last_seen_at' => 'datetime',
            'paused_at' => 'datetime',
            'pause_remaining_ms' => 'integer',
            'music_enabled' => 'boolean',
            'is_preview' => 'boolean',
            'finished_at' => 'datetime',
        ];
    }

    public function scopeSelfPaced($query)
    {
        return $query->where('mode', self::MODE_ASYNC)->where('is_preview', false);
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
            && $this->status === self::STATUS_LOBBY;
    }

    public function isPaused(): bool
    {
        return $this->paused_at !== null;
    }

    public function isLockedLiveHistory(): bool
    {
        if ($this->mode !== self::MODE_LIVE) {
            return false;
        }

        if (! in_array($this->status, [
            self::STATUS_QUESTION,
            self::STATUS_REVEAL,
            self::STATUS_LEADERBOARD,
        ], true)) {
            return false;
        }

        $cutoff = now()->subMinutes(max(1, (int) config('quiz.live_session_lock_minutes', 20)));
        $seen = $this->host_last_seen_at ?? $this->updated_at;

        return $seen && $seen->gte($cutoff);
    }
}
