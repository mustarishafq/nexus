<?php

namespace App\Jobs;

use App\Models\CalendarEvent;
use App\Services\GoogleCalendarService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Throwable;

class SyncCalendarEventToGoogleJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $timeout = 60;

    public function __construct(public int $calendarEventId) {}

    public function handle(GoogleCalendarService $googleCalendarService): void
    {
        $calendarEvent = CalendarEvent::query()->with('attendees')->find($this->calendarEventId);

        if (! $calendarEvent) {
            return;
        }

        $result = $googleCalendarService->syncEvent($calendarEvent);

        if (! $result['success']) {
            $calendarEvent->update([
                'google_sync_status' => 'failed',
                'google_sync_error' => $result['error'],
            ]);

            return;
        }

        $calendarEvent->update([
            'google_event_id' => $result['event_id'],
            'google_calendar_url' => $result['url'],
            'google_sync_status' => 'synced',
            'google_sync_error' => $result['error'],
        ]);
    }

    public function failed(?Throwable $exception): void
    {
        Log::warning('Google Calendar sync job failed.', [
            'calendar_event_id' => $this->calendarEventId,
            'error' => $exception?->getMessage(),
        ]);

        CalendarEvent::query()
            ->whereKey($this->calendarEventId)
            ->update([
                'google_sync_status' => 'failed',
                'google_sync_error' => $exception?->getMessage() ?: 'Google Calendar sync failed.',
            ]);
    }
}
