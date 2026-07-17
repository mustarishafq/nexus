<?php

namespace App\Jobs;

use App\Models\CalendarEvent;
use App\Models\User;
use App\Services\CalendarEventNotificationService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Throwable;

class NotifyCalendarInviteesJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 2;

    public int $timeout = 120;

    /**
     * @param  array<string, mixed>|null  $eventSnapshot  Used when the local event is already deleted (cancel).
     */
    public function __construct(
        public string $action,
        public ?int $calendarEventId = null,
        public ?int $actorId = null,
        public ?array $eventSnapshot = null,
    ) {}

    public function handle(CalendarEventNotificationService $notificationService): void
    {
        $actor = $this->actorId ? User::query()->find($this->actorId) : null;

        if ($this->eventSnapshot) {
            $notificationService->notifyInviteesFromSnapshot($this->eventSnapshot, $this->action, $actor);

            return;
        }

        if (! $this->calendarEventId) {
            return;
        }

        $event = CalendarEvent::query()->with('attendees')->find($this->calendarEventId);

        if (! $event) {
            return;
        }

        $notificationService->notifyInvitees($event, $this->action, $actor);
    }

    public function failed(?Throwable $exception): void
    {
        Log::warning('Calendar invitee notification job failed.', [
            'calendar_event_id' => $this->calendarEventId,
            'action' => $this->action,
            'error' => $exception?->getMessage(),
        ]);
    }
}
