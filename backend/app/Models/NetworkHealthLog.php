<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class NetworkHealthLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'latency_ms',
        'download_mbps',
        'upload_mbps',
        'browser',
        'browser_version',
        'operating_system',
        'device_type',
        'screen_resolution',
        'timezone',
        'ip_address',
        'tested_at',
    ];

    protected $appends = [
        'created_date',
        'updated_date',
    ];

    protected function casts(): array
    {
        return [
            'latency_ms' => 'integer',
            'download_mbps' => 'decimal:2',
            'upload_mbps' => 'decimal:2',
            'tested_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function alerts(): HasMany
    {
        return $this->hasMany(NetworkHealthAlert::class);
    }

    public function getCreatedDateAttribute(): ?string
    {
        return $this->created_at?->toISOString();
    }

    public function getUpdatedDateAttribute(): ?string
    {
        return $this->updated_at?->toISOString();
    }
}
