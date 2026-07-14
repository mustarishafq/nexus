<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserMailCredential extends Model
{
    protected $fillable = [
        'user_id',
        'email',
        'label',
        'is_primary',
        'password',
        'verified_at',
    ];

    protected function casts(): array
    {
        return [
            'is_primary' => 'boolean',
            'verified_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return array{id: int, email: string, label: string|null, is_primary: bool, verified_at: string|null}
     */
    public function toMailboxArray(): array
    {
        return [
            'id' => $this->id,
            'email' => $this->email,
            'label' => $this->label,
            'is_primary' => (bool) $this->is_primary,
            'verified_at' => $this->verified_at?->toIso8601String(),
        ];
    }
}
