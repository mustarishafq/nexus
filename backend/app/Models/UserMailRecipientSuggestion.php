<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserMailRecipientSuggestion extends Model
{
    protected $fillable = [
        'user_id',
        'email',
        'display_name',
        'use_count',
        'last_used_at',
    ];

    protected function casts(): array
    {
        return [
            'use_count' => 'integer',
            'last_used_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return array{email: string, display_name: string|null, source: string, use_count: int}
     */
    public function toSuggestionArray(): array
    {
        return [
            'email' => $this->email,
            'display_name' => $this->display_name,
            'source' => 'history',
            'use_count' => (int) $this->use_count,
        ];
    }
}
