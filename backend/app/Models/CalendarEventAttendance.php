<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CalendarEventAttendance extends Model
{
    public const SOURCE_IN_APP = 'in_app';

    public const SOURCE_PUBLIC_FORM = 'public_form';

    protected $fillable = [
        'calendar_event_id',
        'email',
        'user_id',
        'display_name',
        'source',
        'checked_in_at',
    ];

    protected function casts(): array
    {
        return [
            'checked_in_at' => 'datetime',
        ];
    }

    public function calendarEvent(): BelongsTo
    {
        return $this->belongsTo(CalendarEvent::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
