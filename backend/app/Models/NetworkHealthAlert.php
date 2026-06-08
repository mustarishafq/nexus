<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NetworkHealthAlert extends Model
{
    use HasFactory;

    protected $fillable = [
        'network_health_log_id',
        'user_id',
        'alert_type',
        'metric_value',
        'threshold_value',
        'status',
        'acknowledged_by',
        'acknowledged_at',
    ];

    protected $appends = [
        'created_date',
        'updated_date',
    ];

    protected function casts(): array
    {
        return [
            'metric_value' => 'decimal:2',
            'threshold_value' => 'decimal:2',
            'acknowledged_at' => 'datetime',
        ];
    }

    public function log(): BelongsTo
    {
        return $this->belongsTo(NetworkHealthLog::class, 'network_health_log_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function acknowledgedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'acknowledged_by');
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
