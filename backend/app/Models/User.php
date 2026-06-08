<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'full_name',
        'email',
        'password',
        'role',
        'is_approved',
        'force_password_change',
        'notification_settings',
        'date_of_birth',
        'joined_at',
    ];

    protected $appends = [
        'created_date',
        'updated_date',
        'access_group_ids',
        'access_group_names',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_approved' => 'boolean',
            'force_password_change' => 'boolean',
            'notification_settings' => 'array',
            'date_of_birth' => 'date',
            'joined_at' => 'date',
        ];
    }

    public function accessGroups(): BelongsToMany
    {
        return $this->belongsToMany(AccessGroup::class)->withTimestamps();
    }

    /**
     * @return array<int, int>
     */
    public function getAccessGroupIdsAttribute(): array
    {
        if ($this->relationLoaded('accessGroups')) {
            return $this->accessGroups
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->values()
                ->all();
        }

        return $this->accessGroups()
            ->pluck('access_groups.id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();
    }

    /**
     * @return array<int, string>
     */
    public function getAccessGroupNamesAttribute(): array
    {
        if ($this->relationLoaded('accessGroups')) {
            return $this->accessGroups->pluck('name')->values()->all();
        }

        return $this->accessGroups()->pluck('name')->values()->all();
    }

    public function getCreatedDateAttribute(): ?string
    {
        return $this->created_at?->toISOString();
    }

    public function getUpdatedDateAttribute(): ?string
    {
        return $this->updated_at?->toISOString();
    }

    public function toArray(): array
    {
        $array = parent::toArray();

        if ($this->date_of_birth) {
            $array['date_of_birth'] = $this->date_of_birth->toDateString();
        }

        if ($this->joined_at) {
            $array['joined_at'] = $this->joined_at->toDateString();
        }

        return $array;
    }
}
