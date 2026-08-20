<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QuizSessionPowerUp extends Model
{
    public const TYPE_ERASER = 'eraser';

    public const TYPE_DOUBLE = 'double';

    public const TYPE_STREAK_FREEZE = 'streak_freeze';

    public const TYPE_BONUS = 'bonus';

    public const BONUS_POINTS = 500;

    public const TYPES = [
        self::TYPE_ERASER,
        self::TYPE_DOUBLE,
        self::TYPE_STREAK_FREEZE,
        self::TYPE_BONUS,
    ];

    /** Scoring power-ups cannot be armed together on the same question. */
    public const SCORING_TYPES = [
        self::TYPE_DOUBLE,
        self::TYPE_BONUS,
    ];

    protected $fillable = [
        'quiz_session_id',
        'user_id',
        'type',
        'uses_remaining',
        'active_until_question_id',
        'payload',
    ];

    protected function casts(): array
    {
        return [
            'uses_remaining' => 'integer',
            'payload' => 'array',
        ];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(QuizSession::class, 'quiz_session_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
