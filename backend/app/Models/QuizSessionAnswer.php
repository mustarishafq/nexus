<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QuizSessionAnswer extends Model
{
    protected $fillable = [
        'quiz_session_id',
        'quiz_question_id',
        'user_id',
        'quiz_option_id',
        'is_correct',
        'points_awarded',
        'streak_after',
        'power_up_used',
        'answered_at',
        'response_ms',
    ];

    protected function casts(): array
    {
        return [
            'is_correct' => 'boolean',
            'points_awarded' => 'integer',
            'streak_after' => 'integer',
            'answered_at' => 'datetime',
            'response_ms' => 'integer',
        ];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(QuizSession::class, 'quiz_session_id');
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(QuizQuestion::class, 'quiz_question_id');
    }

    public function option(): BelongsTo
    {
        return $this->belongsTo(QuizOption::class, 'quiz_option_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
