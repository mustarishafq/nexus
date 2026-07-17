<?php

namespace App\Jobs;

use App\Models\CalendarEvent;
use App\Services\GoogleCalendarService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Throwable;

class DeleteCalendarEventFromGoogleJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $timeout = 60;

    public function __construct(
        public ?string $googleEventId,
        public ?string $createdByEmail,
    ) {}

    public function handle(GoogleCalendarService $googleCalendarService): void
    {
        if (! filled($this->googleEventId)) {
            return;
        }

        $calendarEvent = new CalendarEvent([
            'google_event_id' => $this->googleEventId,
            'created_by' => $this->createdByEmail,
        ]);

        $googleCalendarService->deleteEvent($calendarEvent);
    }

    public function failed(?Throwable $exception): void
    {
        Log::warning('Google Calendar delete job failed.', [
            'google_event_id' => $this->googleEventId,
            'created_by' => $this->createdByEmail,
            'error' => $exception?->getMessage(),
        ]);
    }
}
