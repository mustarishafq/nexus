<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Message extends Model
{
    protected $fillable = [
        'conversation_id',
        'sender_user_id',
        'body',
        'edited_at',
        'deleted_at',
    ];

    protected $appends = [
        'created_date',
    ];

    protected function casts(): array
    {
        return [
            'edited_at' => 'datetime',
            // Plain cast only — this model intentionally does not use the
            // SoftDeletes trait. See the migration that added this column
            // for why: a deleted message must stay visible as a tombstone.
            'deleted_at' => 'datetime',
        ];
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_user_id');
    }

    public function edits(): HasMany
    {
        return $this->hasMany(MessageEdit::class)->orderByDesc('created_at');
    }

    public function reactions(): HasMany
    {
        return $this->hasMany(MessageReaction::class);
    }

    public function isDeleted(): bool
    {
        return $this->deleted_at !== null;
    }

    public function getCreatedDateAttribute(): ?string
    {
        return $this->created_at?->toISOString();
    }
}
