<?php

namespace App\Models;

use App\Casts\AppTimezoneDateTime;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

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
        'source_system_id',
        'external_event_id',
        'google_calendar_url',
        'google_event_id',
        'google_sync_status',
        'google_sync_error',
    ];

    protected $appends = [
        'created_date',
        'updated_date',
        'attendee_emails',
    ];

    protected function casts(): array
    {
        return [
            'start_at' => AppTimezoneDateTime::class,
            'end_at' => AppTimezoneDateTime::class,
            'is_all_day' => 'boolean',
        ];
    }

    public function attendees(): HasMany
    {
        return $this->hasMany(CalendarEventAttendee::class);
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
