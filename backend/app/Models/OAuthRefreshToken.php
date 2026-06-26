<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OAuthRefreshToken extends Model
{
    protected $table = 'oauth_refresh_tokens';

    protected $fillable = [
        'token_hash',
        'auth_token_id',
        'client_id',
        'user_id',
        'expires_at',
        'revoked_at',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function authToken(): BelongsTo
    {
        return $this->belongsTo(AuthToken::class);
    }

    public function isUsable(): bool
    {
        return $this->revoked_at === null && $this->expires_at->isFuture();
    }
}
