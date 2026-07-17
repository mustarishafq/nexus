<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AttendanceLocation extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'geofence_enabled',
        'center_latitude',
        'center_longitude',
        'sites',
        'radius_meters',
        'allow_outside_radius',
    ];

    protected function casts(): array
    {
        return [
            'geofence_enabled' => 'boolean',
            'center_latitude' => 'decimal:7',
            'center_longitude' => 'decimal:7',
            'sites' => 'array',
            'radius_meters' => 'integer',
            'allow_outside_radius' => 'boolean',
        ];
    }

    public function departmentSettings(): HasMany
    {
        return $this->hasMany(DepartmentAttendanceSetting::class);
    }
}
