<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasFactory, Notifiable, SoftDeletes;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'full_name',
        'profile_picture',
        'profile_picture_crop',
        'cover_picture',
        'cover_picture_crops',
        'bio',
        'department_id',
        'company_id',
        'job_title',
        'work_phone',
        'personal_phone',
        'personal_phone_visible',
        'manager_id',
        'employee_id',
        'employment_type',
        'emergency_contact_name',
        'emergency_contact_phone',
        'next_of_kin_relationship',
        'next_of_kin_ic_number',
        'next_of_kin_nationality',
        'next_of_kin_occupation',
        'next_of_kin_address',
        'spouse_details',
        'children',
        'gender',
        'place_of_birth',
        'nationality',
        'religion',
        'race',
        'marital_status',
        'current_address',
        'home_phone',
        'ic_number',
        'epf_number',
        'socso_number',
        'income_tax_number',
        'location',
        'ask_me_about',
        'email',
        'password',
        'role',
        'mcp_access',
        'is_approved',
        'force_password_change',
        'notification_settings',
        'date_of_birth',
        'joined_at',
        'last_profile_nudge_at',
        'last_login_at',
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
            'cover_picture_crops' => 'array',
            'profile_picture_crop' => 'array',
            'personal_phone_visible' => 'boolean',
            'spouse_details' => 'array',
            'children' => 'array',
            'date_of_birth' => 'date',
            'joined_at' => 'date',
            'last_profile_nudge_at' => 'datetime',
            'last_login_at' => 'datetime',
        ];
    }

    public function displayName(): string
    {
        $name = trim((string) ($this->name ?: $this->full_name ?: $this->email ?: ''));

        return $name !== '' ? $name : 'User';
    }

    public function scopeMatchingSearch(Builder $query, string $term): Builder
    {
        $term = trim($term);
        if ($term === '') {
            return $query;
        }

        $like = '%'.$term.'%';

        return $query->where(function (Builder $builder) use ($like) {
            $builder->where('name', 'like', $like)
                ->orWhere('full_name', 'like', $like)
                ->orWhere('email', 'like', $like)
                ->orWhere('bio', 'like', $like)
                ->orWhere('location', 'like', $like)
                ->orWhere('ask_me_about', 'like', $like)
                ->orWhere('job_title', 'like', $like)
                ->orWhereHas('userSkills', fn (Builder $skillQuery) => $skillQuery->where('name', 'like', $like))
                ->orWhereHas('department', fn (Builder $departmentQuery) => $departmentQuery->where('name', 'like', $like))
                ->orWhereHas('company', fn (Builder $companyQuery) => $companyQuery->where('name', 'like', $like));
        });
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function manager(): BelongsTo
    {
        return $this->belongsTo(self::class, 'manager_id');
    }

    public function directReports(): HasMany
    {
        return $this->hasMany(self::class, 'manager_id');
    }

    public function educations(): HasMany
    {
        return $this->hasMany(UserEducation::class)->orderBy('sort_order');
    }

    public function workExperiences(): HasMany
    {
        return $this->hasMany(UserWorkExperience::class)->orderBy('sort_order');
    }

    public function userSkills(): HasMany
    {
        return $this->hasMany(UserSkill::class)->orderBy('sort_order');
    }

    public function pushSubscriptions(): HasMany
    {
        return $this->hasMany(PushSubscription::class);
    }

    /**
     * @return array<int, string>
     */
    public function skillsList(): array
    {
        if (! $this->relationLoaded('userSkills')) {
            return [];
        }

        return $this->userSkills->pluck('name')->values()->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function educationHistoryList(): array
    {
        if (! $this->relationLoaded('educations')) {
            return [];
        }

        return $this->educations
            ->map(fn (UserEducation $education) => [
                'institution' => $education->institution,
                'qualification' => $education->qualification,
                'field_of_study' => $education->field_of_study,
                'year_from' => $education->year_from,
                'year_to' => $education->year_to,
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function workHistoryList(): array
    {
        if (! $this->relationLoaded('workExperiences')) {
            return [];
        }

        return $this->workExperiences
            ->map(fn (UserWorkExperience $experience) => [
                'company' => $experience->company,
                'job_title' => $experience->job_title,
                'date_from' => $experience->date_from,
                'date_to' => $experience->date_to,
                'description' => $experience->description,
            ])
            ->values()
            ->all();
    }

    public function accessGroups(): BelongsToMany
    {
        return $this->belongsToMany(AccessGroup::class)->withTimestamps();
    }

    public function applicationMcpAccess(): HasMany
    {
        return $this->hasMany(UserApplicationMcpAccess::class);
    }

    public function networkHealthLogs(): HasMany
    {
        return $this->hasMany(NetworkHealthLog::class);
    }

    public function networkHealthAlerts(): HasMany
    {
        return $this->hasMany(NetworkHealthAlert::class);
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

        $department = $this->relationLoaded('department')
            ? $this->getRelation('department')
            : $this->department()->first();

        $array['department'] = $department?->name;
        $array['department_id'] = $this->department_id;

        $company = $this->relationLoaded('company')
            ? $this->getRelation('company')
            : $this->company()->first();

        $array['company'] = $company?->name;
        $array['company_id'] = $this->company_id;

        if ($this->date_of_birth) {
            $array['date_of_birth'] = $this->date_of_birth->toDateString();
        }

        if ($this->joined_at) {
            $array['joined_at'] = $this->joined_at->toDateString();
        }

        $array['skills'] = $this->skillsList();
        $array['education_history'] = $this->educationHistoryList();
        $array['work_history'] = $this->workHistoryList();

        if ($this->relationLoaded('manager')) {
            $manager = $this->getRelation('manager');
            $array['manager'] = $manager ? [
                'id' => $manager->id,
                'name' => $manager->displayName(),
                'profile_picture' => $manager->profile_picture,
                'job_title' => $manager->job_title,
            ] : null;
        }

        return $array;
    }
}
