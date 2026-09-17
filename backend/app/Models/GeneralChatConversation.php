<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GeneralChatConversation extends Model
{
    protected $fillable = [
        'user_id',
        'title',
        'pinned_at',
        'use_memory',
        'last_message_at',
    ];

    protected function casts(): array
    {
        return [
            'last_message_at' => 'datetime',
            'pinned_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(GeneralChatMessage::class)->orderBy('id');
    }

    public function usesMemory(bool $autoDefault): bool
    {
        $raw = $this->getAttributes()['use_memory'] ?? null;
        if ($raw === null) {
            return $autoDefault;
        }

        return filter_var($raw, FILTER_VALIDATE_BOOLEAN);
    }
}
