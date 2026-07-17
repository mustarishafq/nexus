<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuthToken extends Model
{
    protected $fillable = [
        'user_id',
        'oauth_client_id',
        'token_hash',
        'label',
        'last_used_at',
        'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'last_used_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function oauthClient(): BelongsTo
    {
        return $this->belongsTo(OAuthClient::class, 'oauth_client_id', 'client_id');
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }

    private const LAST_USED_THROTTLE_MINUTES = 10;

    public function touchLastUsed(): void
    {
        if (
            $this->last_used_at !== null
            && $this->last_used_at->gt(now()->subMinutes(self::LAST_USED_THROTTLE_MINUTES))
        ) {
            return;
        }

        $this->forceFill(['last_used_at' => now()])->save();
    }
}
