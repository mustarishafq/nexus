<?php

namespace App\Services;

use App\Models\CalendarEvent;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Collection;

class CalendarEventNotificationService
{
    public const ACTION_CREATED = 'created';

    public const ACTION_RESCHEDULED = 'rescheduled';

    public const ACTION_CANCELLED = 'cancelled';

    public function notifyInvitees(CalendarEvent $event, string $action, ?User $actor = null): void
    {
        if (! in_array($action, [self::ACTION_CREATED, self::ACTION_RESCHEDULED, self::ACTION_CANCELLED], true)) {
            return;
        }

        $event->loadMissing('attendees');

        $recipientEmails = $this->inviteeEmails($event);

        if ($recipientEmails->isEmpty()) {
            return;
        }

        $users = User::query()
            ->where('is_approved', true)
            ->where(function ($query) use ($recipientEmails) {
                foreach ($recipientEmails as $email) {
                    $query->orWhereRaw('LOWER(email) = ?', [$email]);
                }
            })
            ->get(['id', 'email', 'name', 'full_name']);

        if ($users->isEmpty()) {
            return;
        }

        $organizerName = $this->resolveOrganizerName($event, $actor);
        $schedule = $this->formatSchedule($event);

        $systemId = filled($event->source_system_id) ? (string) $event->source_system_id : null;

        foreach ($users as $user) {
            $notification = Notification::create([
                'user_id' => (string) $user->id,
                'system_id' => $systemId,
                'type' => $action === self::ACTION_CANCELLED ? 'warning' : 'info',
                'priority' => 'medium',
                'category' => 'calendar',
                'title' => $this->titleFor($action, (string) $event->title),
                'message' => $this->messageFor($action, $event, $organizerName, $schedule),
                'action_url' => '/calendar',
                'is_read' => false,
                'is_broadcast' => false,
                'delivery_channels' => ['in_app'],
                'data' => [
                    'kind' => 'calendar_event_'.$action,
                    'action' => $action,
                    'calendar_event_id' => $event->id,
                    'event_title' => $event->title,
                    'start_at' => $event->start_at?->toISOString(),
                    'end_at' => $event->end_at?->toISOString(),
                    'organizer_email' => $event->created_by,
                    'organizer_name' => $organizerName,
                ],
            ]);

            app(PushNotificationService::class)->sendNotification($notification);
        }
    }

    /**
     * @return Collection<int, string>
     */
    protected function inviteeEmails(CalendarEvent $event): Collection
    {
        $organizerEmail = strtolower(trim((string) $event->created_by));

        return collect($event->attendeeEmailList())
            ->map(fn ($email) => strtolower(trim((string) $email)))
            ->filter()
            ->reject(fn (string $email) => $organizerEmail !== '' && $email === $organizerEmail)
            ->unique()
            ->values();
    }

    protected function titleFor(string $action, string $title): string
    {
        $eventTitle = mb_strlen($title) > 60 ? mb_substr($title, 0, 57).'...' : $title;

        return match ($action) {
            self::ACTION_CREATED => "Meeting invitation: {$eventTitle}",
            self::ACTION_RESCHEDULED => "Meeting rescheduled: {$eventTitle}",
            self::ACTION_CANCELLED => "Meeting cancelled: {$eventTitle}",
            default => $eventTitle,
        };
    }

    protected function messageFor(string $action, CalendarEvent $event, string $organizerName, string $schedule): string
    {
        return match ($action) {
            self::ACTION_CREATED => "{$organizerName} invited you to {$event->title} on {$schedule}.",
            self::ACTION_RESCHEDULED => "{$organizerName} rescheduled {$event->title} to {$schedule}.",
            self::ACTION_CANCELLED => "{$organizerName} cancelled {$event->title} (was {$schedule}).",
            default => $schedule,
        };
    }

    protected function formatSchedule(CalendarEvent $event): string
    {
        $timezone = (string) config('app.timezone', 'UTC');
        $start = $event->start_at?->timezone($timezone);
        $end = $event->end_at?->timezone($timezone);

        if (! $start || ! $end) {
            return 'TBD';
        }

        if ($event->is_all_day) {
            if ($start->isSameDay($end)) {
                return $start->format('M j, Y').' (all day)';
            }

            return $start->format('M j, Y').' – '.$end->format('M j, Y').' (all day)';
        }

        if ($start->isSameDay($end)) {
            return $start->format('M j, Y g:ia').' – '.$end->format('g:ia');
        }

        return $start->format('M j, Y g:ia').' – '.$end->format('M j, Y g:ia');
    }

    protected function resolveOrganizerName(CalendarEvent $event, ?User $actor): string
    {
        if ($actor) {
            return $actor->displayName();
        }

        if (! filled($event->created_by)) {
            return 'Someone';
        }

        $organizer = User::query()
            ->whereRaw('LOWER(email) = ?', [strtolower(trim((string) $event->created_by))])
            ->first(['id', 'name', 'full_name', 'email']);

        return $organizer?->displayName() ?? (string) $event->created_by;
    }
}
