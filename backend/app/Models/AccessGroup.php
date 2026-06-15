<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class AccessGroup extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'description',
    ];

    protected $appends = [
        'created_date',
        'updated_date',
        'user_count',
        'allowed_system_slugs',
    ];

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class)->withTimestamps();
    }

    public function allowedApplications(): BelongsToMany
    {
        return $this->belongsToMany(Application::class, 'access_group_applications')->withTimestamps();
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

    public function getUserCountAttribute(): int
    {
        if (array_key_exists('users_count', $this->attributes)) {
            return (int) $this->attributes['users_count'];
        }

        if ($this->relationLoaded('users')) {
            return $this->users->count();
        }

        return $this->users()->count();
    }
}
