<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Application extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'description',
        'base_url',
        'icon_url',
        'status',
        'environment',
        'api_key',
        'auth_mode',
        'open_mode',
        'visibility',
        'created_by_user_id',
        'is_enabled',
        'last_heartbeat',
        'notification_config',
        'calendar_config',
        'mcp_catalog_path',
        'mcp_api_key',
        'mcp_enabled',
        'color',
        'sort_order',
    ];

    protected $appends = [
        'created_date',
        'updated_date',
        'created_by_credit',
        'private_allowed_user_emails',
    ];

    protected function casts(): array
    {
        return [
            'is_enabled' => 'boolean',
            'mcp_enabled' => 'boolean',
            'last_heartbeat' => 'datetime',
            'notification_config' => 'array',
            'calendar_config' => 'array',
        ];
    }

    public function privateAccessEmails(): HasMany
    {
        return $this->hasMany(ApplicationPrivateAccessEmail::class);
    }

    public function ssoCredentials(): HasMany
    {
        return $this->hasMany(ApplicationSsoCredential::class);
    }

    /**
     * @return array<int, string>
     */
    public function privateAllowedEmailsList(): array
    {
        if (! $this->relationLoaded('privateAccessEmails')) {
            return [];
        }

        return $this->privateAccessEmails->pluck('email')->values()->all();
    }

    public function getPrivateAllowedUserEmailsAttribute(): array
    {
        return $this->privateAllowedEmailsList();
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function getCreatedDateAttribute(): ?string
    {
        return $this->created_at ? $this->created_at->toISOString() : null;
    }

    public function getUpdatedDateAttribute(): ?string
    {
        return $this->updated_at ? $this->updated_at->toISOString() : null;
    }

    public function getCreatedByCreditAttribute(): ?string
    {
        if (! $this->relationLoaded('creator')) {
            $this->loadMissing('creator');
        }

        if (! $this->creator) {
            return null;
        }

        return $this->creator->full_name ?: $this->creator->name ?: $this->creator->email;
    }
}
