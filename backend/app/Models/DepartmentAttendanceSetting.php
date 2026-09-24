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
        'require_early_clock_out_reason',
        'require_late_clock_in_reason',
        'allow_outside_shift_hours',
        'allow_different_shift_clock_in',
        'overtime_enabled',
        'shortage_enabled',
        'count_work_from_scheduled_start',
        'standard_hours_per_day',
        'overtime_threshold_minutes',
        'shifts',
    ];

    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
            'grace_period_minutes' => 'integer',
            'require_early_clock_out_reason' => 'boolean',
            'require_late_clock_in_reason' => 'boolean',
            'allow_outside_shift_hours' => 'boolean',
            'allow_different_shift_clock_in' => 'boolean',
            'overtime_enabled' => 'boolean',
            'shortage_enabled' => 'boolean',
            'count_work_from_scheduled_start' => 'boolean',
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
