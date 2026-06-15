<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class UserSystemAccess extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_email',
    ];

    protected $appends = [
        'created_date',
        'updated_date',
        'allowed_system_slugs',
    ];

    public function allowedApplications(): BelongsToMany
    {
        return $this->belongsToMany(Application::class, 'user_system_access_applications')->withTimestamps();
    }

    /**
     * @return array<int, string>
     */
    public function allowedSystemSlugs(): array
    {
        if (! $this->relationLoaded('allowedApplications')) {
            return [];
        }

        return $this->allowedApplications->pluck('slug')->values()->all();
    }

    public function getAllowedSystemSlugsAttribute(): array
    {
        return $this->allowedSystemSlugs();
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
