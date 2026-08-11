<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AttendanceLocation extends Model
{
    use HasFactory;

    protected $fillable = [
        'owner_user_id',
        'name',
        'geofence_enabled',
        'center_latitude',
        'center_longitude',
        'sites',
        'radius_meters',
        'allow_outside_radius',
        'allow_clock_out_outside_radius',
    ];

    protected function casts(): array
    {
        return [
            'owner_user_id' => 'integer',
            'geofence_enabled' => 'boolean',
            'center_latitude' => 'decimal:7',
            'center_longitude' => 'decimal:7',
            'sites' => 'array',
            'radius_meters' => 'integer',
            'allow_outside_radius' => 'boolean',
            'allow_clock_out_outside_radius' => 'boolean',
        ];
    }

    public function allowsOutsideRadiusFor(string $type): bool
    {
        return $type === 'clock_out'
            ? (bool) $this->allow_clock_out_outside_radius
            : (bool) $this->allow_outside_radius;
    }

    public function owner(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    public function departmentSettings(): HasMany
    {
        return $this->hasMany(DepartmentAttendanceSetting::class);
    }

    public function isPersonal(): bool
    {
        return $this->owner_user_id !== null;
    }

    public function isVisibleToUser(?int $userId): bool
    {
        if ($this->owner_user_id === null) {
            return true;
        }

        return $userId !== null && (int) $this->owner_user_id === (int) $userId;
    }

    public function scopeShared($query)
    {
        return $query->whereNull('owner_user_id');
    }

    /**
     * @param  list<int|null>  $ids
     * @return list<int>
     */
    public static function existingSharedIds(array $ids): array
    {
        $ids = array_values(array_unique(array_filter(
            array_map(static fn ($id) => $id === null || $id === '' ? null : (int) $id, $ids),
            static fn ($id) => $id !== null && $id > 0,
        )));

        if ($ids === []) {
            return [];
        }

        return static::query()
            ->shared()
            ->whereIn('id', $ids)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }
}
