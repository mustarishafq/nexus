<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GeneralChatTokenGrant extends Model
{
    protected $fillable = [
        'user_id',
        'tokens',
        'period_starts_at',
        'note',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'tokens' => 'integer',
            'period_starts_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
