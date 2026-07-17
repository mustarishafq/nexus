<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DepartmentAttendanceSetting extends Model
{
    use HasFactory;

    protected $fillable = [
        'department_id',
        'attendance_location_id',
        'enabled',
        'timezone',
        'grace_period_minutes',
        'allow_outside_shift_hours',
        'overtime_enabled',
        'standard_hours_per_day',
        'overtime_threshold_minutes',
        'shifts',
    ];

    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
            'grace_period_minutes' => 'integer',
            'allow_outside_shift_hours' => 'boolean',
            'overtime_enabled' => 'boolean',
            'standard_hours_per_day' => 'decimal:2',
            'overtime_threshold_minutes' => 'integer',
            'shifts' => 'array',
        ];
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function attendanceLocation(): BelongsTo
    {
        return $this->belongsTo(AttendanceLocation::class);
    }
}
