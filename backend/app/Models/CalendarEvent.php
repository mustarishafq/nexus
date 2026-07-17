<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class CalendarEvent extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'description',
        'location',
        'start_at',
        'end_at',
        'is_all_day',
        'created_by',
        'check_in_token',
        'check_in_opens_at',
        'source_system_id',
        'external_event_id',
        'google_calendar_url',
        'google_event_id',
        'google_sync_status',
        'google_sync_error',
    ];

    protected $hidden = [
        'check_in_token',
    ];

    protected $appends = [
        'created_date',
        'updated_date',
        'attendee_emails',
    ];

    protected static function booted(): void
    {
        static::creating(function (CalendarEvent $event): void {
            if (empty($event->check_in_token)) {
                $event->check_in_token = (string) Str::uuid();
            }
        });
    }

    protected function casts(): array
    {
        return [
            'start_at' => 'datetime',
            'end_at' => 'datetime',
            'check_in_opens_at' => 'datetime',
            'is_all_day' => 'boolean',
        ];
    }

    public function attendees(): HasMany
    {
        return $this->hasMany(CalendarEventAttendee::class);
    }

    public function checkIns(): HasMany
    {
        return $this->hasMany(CalendarEventAttendance::class);
    }

    public function isAttendanceOpen(?Carbon $at = null): bool
    {
        if (! $this->check_in_opens_at) {
            return true;
        }

        $at ??= now();

        return $at->greaterThanOrEqualTo($this->check_in_opens_at);
    }

    public function checkInUrl(): ?string
    {
        if (! $this->check_in_token) {
            return null;
        }

        $frontendUrl = rtrim((string) config('app.frontend_url'), '/');

        return $frontendUrl.'/event-check-in/'.$this->check_in_token;
    }

    /**
     * @return array<int, string>
     */
    public function attendeeEmailList(): array
    {
        if (! $this->relationLoaded('attendees')) {
            return [];
        }

        return $this->attendees->pluck('email')->values()->all();
    }

    public function getAttendeeEmailsAttribute(): ?array
    {
        $emails = $this->attendeeEmailList();

        return $emails === [] ? null : $emails;
    }

    public function getCreatedDateAttribute(): ?string
    {
        return $this->created_at ? $this->created_at->toISOString() : null;
    }

    public function getUpdatedDateAttribute(): ?string
    {
        return $this->updated_at ? $this->updated_at->toISOString() : null;
    }
}
