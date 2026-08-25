<?php

namespace App\Services;

use App\Models\Application;
use App\Models\CalendarEvent;
use App\Models\User;
use App\Support\SyncAssignmentRecords;
use Illuminate\Support\Carbon;

class CalendarEventIntegrationService
{
    public function __construct(
        protected CalendarEventMapperService $mapper,
        protected CalendarEventNotificationService $notificationService,
    ) {}

    /**
     * @return array{action: string, calendar_event: CalendarEvent|null, notify_action: string|null}
     */
    public function processWebhookEvent(Application $application, array $event, ?array $configOverride = null): array
    {
        $mapped = $this->mapper->map($application, $event, $configOverride);
        $action = (string) ($mapped['action'] ?? 'created');
        $externalEventId = (string) $mapped['external_event_id'];

        $existing = CalendarEvent::query()
            ->where('source_system_id', $application->slug)
            ->where('external_event_id', $externalEventId)
            ->first();

        if ($action === 'cancelled') {
            return $this->cancelEvent($existing, $application);
        }

        $organizerEmail = $this->resolveOrganizerEmail($application, $mapped);

        if ($existing) {
            return $this->updateEvent($existing, $mapped, $organizerEmail, $action);
        }

        return $this->createEvent($application, $mapped, $organizerEmail);
    }

    /**
     * @return array{action: string, calendar_event: CalendarEvent|null, notify_action: string|null}
     */
    protected function createEvent(Application $application, array $mapped, string $organizerEmail): array
    {
        $attendeeEmails = $mapped['attendee_emails'] ?? null;

        $calendarEvent = CalendarEvent::create([
            'title' => $mapped['title'],
            'description' => $mapped['description'] ?? null,
            'location' => $mapped['location'] ?? null,
            'start_at' => $mapped['start_at'],
            'end_at' => $mapped['end_at'],
            'is_all_day' => (bool) ($mapped['is_all_day'] ?? false),
            'created_by' => $organizerEmail,
            'source_system_id' => $application->slug,
            'external_event_id' => $mapped['external_event_id'],
        ]);

        SyncAssignmentRecords::syncCalendarEventAttendees($calendarEvent, $attendeeEmails);

        $calendarEvent = $calendarEvent->fresh()->load('attendees');
        $this->notificationService->notifyInvitees(
            $calendarEvent,
            CalendarEventNotificationService::ACTION_CREATED
        );

        return [
            'action' => 'created',
            'calendar_event' => $calendarEvent,
            'notify_action' => CalendarEventNotificationService::ACTION_CREATED,
        ];
    }

    /**
     * @return array{action: string, calendar_event: CalendarEvent|null, notify_action: string|null}
     */
    protected function updateEvent(CalendarEvent $calendarEvent, array $mapped, string $organizerEmail, string $action): array
    {
        $wasRescheduled = $this->wasScheduleChanged($calendarEvent, $mapped);
        $notifyAction = null;

        if ($action === 'rescheduled' || $wasRescheduled) {
            $notifyAction = CalendarEventNotificationService::ACTION_RESCHEDULED;
        }

        $attendeeEmails = array_key_exists('attendee_emails', $mapped)
            ? $mapped['attendee_emails']
            : null;

        $calendarEvent->update([
            'title' => $mapped['title'],
            'description' => $mapped['description'] ?? null,
            'location' => $mapped['location'] ?? null,
            'start_at' => $mapped['start_at'],
            'end_at' => $mapped['end_at'],
            'is_all_day' => (bool) ($mapped['is_all_day'] ?? false),
            'created_by' => $organizerEmail,
        ]);

        if ($attendeeEmails !== null) {
            SyncAssignmentRecords::syncCalendarEventAttendees($calendarEvent, $attendeeEmails);
        }

        $calendarEvent = $calendarEvent->fresh()->load('attendees');

        if ($notifyAction !== null) {
            $this->notificationService->notifyInvitees($calendarEvent, $notifyAction);
        }

        return [
            'action' => $notifyAction ? 'rescheduled' : 'updated',
            'calendar_event' => $calendarEvent,
            'notify_action' => $notifyAction,
        ];
    }

    /**
     * @return array{action: string, calendar_event: CalendarEvent|null, notify_action: string|null}
     */
    protected function cancelEvent(?CalendarEvent $calendarEvent, Application $application): array
    {
        if (! $calendarEvent) {
            return [
                'action' => 'cancelled',
                'calendar_event' => null,
                'notify_action' => null,
            ];
        }

        $calendarEvent->load('attendees');
        $this->notificationService->notifyInvitees(
            $calendarEvent,
            CalendarEventNotificationService::ACTION_CANCELLED
        );

        $calendarEvent->delete();

        return [
            'action' => 'cancelled',
            'calendar_event' => null,
            'notify_action' => CalendarEventNotificationService::ACTION_CANCELLED,
        ];
    }

    protected function resolveOrganizerEmail(Application $application, array $mapped): string
    {
        $mappedOrganizer = strtolower(trim((string) ($mapped['created_by'] ?? '')));

        if ($mappedOrganizer !== '' && filter_var($mappedOrganizer, FILTER_VALIDATE_EMAIL)) {
            return $mappedOrganizer;
        }

        $organizerUserId = $mapped['created_by_user_id'] ?? null;

        if ($organizerUserId !== null && $organizerUserId !== '') {
            $email = User::query()
                ->where('id', (int) $organizerUserId)
                ->where('is_approved', true)
                ->value('email');

            if (filled($email)) {
                return strtolower(trim((string) $email));
            }
        }

        $application->loadMissing('creator');
        $creatorEmail = strtolower(trim((string) ($application->creator?->email ?? '')));

        if ($creatorEmail !== '') {
            return $creatorEmail;
        }

        return 'system+'.$application->slug.'@nexus.local';
    }

    protected function wasScheduleChanged(CalendarEvent $calendarEvent, array $mapped): bool
    {
        if (isset($mapped['start_at']) && $mapped['start_at'] instanceof Carbon) {
            if (! $calendarEvent->start_at->equalTo($mapped['start_at'])) {
                return true;
            }
        }

        if (isset($mapped['end_at']) && $mapped['end_at'] instanceof Carbon) {
            if (! $calendarEvent->end_at->equalTo($mapped['end_at'])) {
                return true;
            }
        }

        if (array_key_exists('is_all_day', $mapped)) {
            if ((bool) $mapped['is_all_day'] !== (bool) $calendarEvent->is_all_day) {
                return true;
            }
        }

        return false;
    }
}
