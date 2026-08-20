<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QuizSessionPlayer extends Model
{
    protected $fillable = [
        'quiz_session_id',
        'user_id',
        'display_name',
        'profile_picture',
        'profile_picture_crop',
        'quiz_accessory_id',
        'score',
        'streak',
        'joined_at',
        'last_seen_at',
    ];

    protected function casts(): array
    {
        return [
            'score' => 'integer',
            'streak' => 'integer',
            'joined_at' => 'datetime',
            'last_seen_at' => 'datetime',
            'profile_picture_crop' => 'array',
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
