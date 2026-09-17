<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GeneralChatMessage extends Model
{
    protected $fillable = [
        'general_chat_conversation_id',
        'role',
        'content',
        'attachments',
        'usage',
    ];

    protected function casts(): array
    {
        return [
            'attachments' => 'array',
            'usage' => 'array',
        ];
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(GeneralChatConversation::class, 'general_chat_conversation_id');
    }
}
