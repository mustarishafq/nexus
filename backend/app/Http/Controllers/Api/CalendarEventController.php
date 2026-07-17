<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AppliesIndexQuery;
use App\Http\Controllers\Controller;
use App\Jobs\DeleteCalendarEventFromGoogleJob;
use App\Jobs\NotifyCalendarInviteesJob;
use App\Jobs\SyncCalendarEventToGoogleJob;
use App\Models\CalendarEvent;
use App\Models\User;
use App\Services\CalendarEventNotificationService;
use App\Support\ApiTokenAuth;
use App\Support\SyncAssignmentRecords;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class CalendarEventController extends Controller
{
    use AppliesIndexQuery;

    public function index(Request $request): JsonResponse
    {
        $user = $this->requireUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        $query = $this->applyIndexQuery(
            $request,
            $this->scopedEventsQuery($user),
            ['is_all_day', 'created_by'],
            'start_at'
        );

        $from = $request->query('from');
        $to = $request->query('to');

        if ($from) {
            $query->where('end_at', '>=', Carbon::parse($from)->startOfDay());
        }

        if ($to) {
            $query->where('start_at', '<=', Carbon::parse($to)->endOfDay());
        }

        $email = strtolower(trim((string) $user->email));

        $events = $query->with([
            'attendees',
            'checkIns' => function ($checkInQuery) use ($user, $email) {
                $checkInQuery->where(function ($inner) use ($user, $email) {
                    $inner->where('user_id', $user->id);

                    if ($email !== '') {
                        $inner->orWhere('email', $email);
                    }
                });
            },
        ])->get();

        return response()->json($this->presentEvents($events, $user));
    }

    public function store(Request $request): JsonResponse
    {
        $user = $this->requireUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'location' => ['nullable', 'string', 'max:255'],
            'start_at' => ['required', 'date'],
            'end_at' => ['required', 'date', 'after_or_equal:start_at'],
            'check_in_opens_at' => ['nullable', 'date'],
            'is_all_day' => ['sometimes', 'boolean'],
            'attendee_emails' => ['nullable', 'array'],
            'attendee_emails.*' => ['email:rfc'],
        ]);

        if (! empty($validated['check_in_opens_at']) && ! empty($validated['end_at'])) {
            if (Carbon::parse($validated['check_in_opens_at'])->gt(Carbon::parse($validated['end_at']))) {
                return response()->json([
                    'message' => 'Attendance cannot open after the event ends.',
                    'errors' => [
                        'check_in_opens_at' => ['Attendance cannot open after the event ends.'],
                    ],
                ], 422);
            }
        }

        $validated['created_by'] = $user->email;
        $attendeeEmails = $this->normalizeAttendeeEmails($validated['attendee_emails'] ?? null);
        unset($validated['attendee_emails']);

        $payload = $this->withGoogleCalendarUrl(array_merge($validated, [
            'attendee_emails' => $attendeeEmails,
        ]));

        $item = CalendarEvent::create(array_merge(
            collect($payload)->except(['attendee_emails'])->all(),
            [
                'google_sync_status' => 'pending',
                'google_sync_error' => null,
            ]
        ));

        SyncAssignmentRecords::syncCalendarEventAttendees($item, $attendeeEmails);

        SyncCalendarEventToGoogleJob::dispatch($item->id)->onQueue('calendar');

        $item = $item->fresh()->load('attendees');
        NotifyCalendarInviteesJob::dispatch(
            CalendarEventNotificationService::ACTION_CREATED,
            $item->id,
            $user->id,
        )->onQueue('calendar');

        return response()->json($this->presentEvent($item, $user), 201);
    }

    public function show(Request $request, CalendarEvent $calendarEvent): JsonResponse
    {
        $user = $this->requireUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        if (! $this->userCanViewEvent($user, $calendarEvent)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return response()->json($this->presentEvent($calendarEvent->load('attendees'), $user));
    }

    public function update(Request $request, CalendarEvent $calendarEvent): JsonResponse
    {
        $user = $this->requireUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        if (! $this->userCanManageEvent($user, $calendarEvent)) {
            return response()->json(['message' => 'You can only edit events you created.'], 403);
        }

        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string'],
            'location' => ['sometimes', 'nullable', 'string', 'max:255'],
            'start_at' => ['sometimes', 'date'],
            'end_at' => ['sometimes', 'date'],
            'check_in_opens_at' => ['sometimes', 'nullable', 'date'],
            'is_all_day' => ['sometimes', 'boolean'],
            'attendee_emails' => ['sometimes', 'nullable', 'array'],
            'attendee_emails.*' => ['email:rfc'],
        ]);

        $attendeeEmails = null;
        if (array_key_exists('attendee_emails', $validated)) {
            $attendeeEmails = $this->normalizeAttendeeEmails($validated['attendee_emails']);
        }
        unset($validated['attendee_emails']);

        $wasRescheduled = $this->wasScheduleChanged($calendarEvent, $validated);

        $startAt = array_key_exists('start_at', $validated) ? $validated['start_at'] : $calendarEvent->start_at;
        $endAt = array_key_exists('end_at', $validated) ? $validated['end_at'] : $calendarEvent->end_at;
        $checkInOpensAt = array_key_exists('check_in_opens_at', $validated)
            ? $validated['check_in_opens_at']
            : $calendarEvent->check_in_opens_at;

        if ($startAt && $endAt && Carbon::parse($endAt)->lt(Carbon::parse($startAt))) {
            return response()->json([
                'message' => 'The end_at must be a date after or equal to start_at.',
                'errors' => [
                    'end_at' => ['The end_at must be a date after or equal to start_at.'],
                ],
            ], 422);
        }

        if ($checkInOpensAt && $endAt && Carbon::parse($checkInOpensAt)->gt(Carbon::parse($endAt))) {
            return response()->json([
                'message' => 'Attendance cannot open after the event ends.',
                'errors' => [
                    'check_in_opens_at' => ['Attendance cannot open after the event ends.'],
                ],
            ], 422);
        }

        $payload = $this->withGoogleCalendarUrl(
            array_merge($validated, $attendeeEmails !== null ? ['attendee_emails' => $attendeeEmails] : []),
            $calendarEvent
        );

        $calendarEvent->update(collect($payload)->except(['attendee_emails'])->all());

        if ($attendeeEmails !== null) {
            SyncAssignmentRecords::syncCalendarEventAttendees($calendarEvent, $attendeeEmails);
        }

        SyncCalendarEventToGoogleJob::dispatch($calendarEvent->id)->onQueue('calendar');

        $calendarEvent = $calendarEvent->fresh()->load('attendees');

        if ($wasRescheduled) {
            NotifyCalendarInviteesJob::dispatch(
                CalendarEventNotificationService::ACTION_RESCHEDULED,
                $calendarEvent->id,
                $user->id,
            )->onQueue('calendar');
        }

        return response()->json($this->presentEvent($calendarEvent, $user));
    }

    public function destroy(Request $request, CalendarEvent $calendarEvent): JsonResponse
    {
        $user = $this->requireUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        if (! $this->userCanManageEvent($user, $calendarEvent)) {
            return response()->json(['message' => 'You can only delete events you created.'], 403);
        }

        $calendarEvent->load('attendees');

        NotifyCalendarInviteesJob::dispatch(
            CalendarEventNotificationService::ACTION_CANCELLED,
            null,
            $user->id,
            [
                'id' => $calendarEvent->id,
                'title' => $calendarEvent->title,
                'description' => $calendarEvent->description,
                'location' => $calendarEvent->location,
                'start_at' => $calendarEvent->start_at?->toISOString(),
                'end_at' => $calendarEvent->end_at?->toISOString(),
                'is_all_day' => (bool) $calendarEvent->is_all_day,
                'created_by' => $calendarEvent->created_by,
                'source_system_id' => $calendarEvent->source_system_id,
                'attendee_emails' => $calendarEvent->attendeeEmailList(),
            ],
        )->onQueue('calendar');

        DeleteCalendarEventFromGoogleJob::dispatch(
            $calendarEvent->google_event_id,
            $calendarEvent->created_by,
        )->onQueue('calendar');

        $calendarEvent->delete();

        return response()->json(null, 204);
    }

    /**
     * @param  \Illuminate\Support\Collection<int, CalendarEvent>|array<int, CalendarEvent>  $events
     * @return array<int, array<string, mixed>>
     */
    protected function presentEvents($events, User $user): array
    {
        return collect($events)
            ->map(fn (CalendarEvent $event) => $this->presentEvent($event, $user))
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    protected function presentEvent(CalendarEvent $event, User $user): array
    {
        $data = $event->toArray();
        $email = strtolower(trim((string) $user->email));

        $attended = $event->relationLoaded('checkIns')
            ? $event->checkIns->contains(function ($checkIn) use ($user, $email) {
                return (int) $checkIn->user_id === (int) $user->id
                    || ($email !== '' && strtolower((string) $checkIn->email) === $email);
            })
            : $event->checkIns()
                ->where(function ($query) use ($user, $email) {
                    $query->where('user_id', $user->id);

                    if ($email !== '') {
                        $query->orWhere('email', $email);
                    }
                })
                ->exists();

        $data['attended_by_me'] = $attended;

        if ($this->userCanManageEvent($user, $event)) {
            $data['check_in_token'] = $event->check_in_token;
            $data['check_in_url'] = $event->checkInUrl();
        }

        return $data;
    }

    protected function requireUser(Request $request): User|JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        return $user;
    }

    protected function scopedEventsQuery(User $user)
    {
        if ($user->role === 'admin') {
            return CalendarEvent::query();
        }

        $email = strtolower(trim((string) $user->email));
        $userId = $user->id;

        return CalendarEvent::query()->with('attendees')->where(function ($query) use ($email, $userId) {
            $query
                ->whereRaw('LOWER(created_by) = ?', [$email])
                ->orWhereHas('attendees', fn ($attendeeQuery) => $attendeeQuery->where('email', $email))
                ->orWhereHas('checkIns', function ($checkInQuery) use ($email, $userId) {
                    $checkInQuery->where(function ($inner) use ($email, $userId) {
                        $inner->where('user_id', $userId);

                        if ($email !== '') {
                            $inner->orWhere('email', $email);
                        }
                    });
                });
        });
    }

    protected function userCanViewEvent(User $user, CalendarEvent $calendarEvent): bool
    {
        if ($user->role === 'admin') {
            return true;
        }

        $email = strtolower(trim((string) $user->email));

        if ($email !== '' && strtolower(trim((string) $calendarEvent->created_by)) === $email) {
            return true;
        }

        $calendarEvent->loadMissing('attendees');
        $attendees = collect($calendarEvent->attendeeEmailList())
            ->map(fn ($value) => strtolower(trim((string) $value)))
            ->filter()
            ->all();

        if (in_array($email, $attendees, true)) {
            return true;
        }

        return $calendarEvent->checkIns()
            ->where(function ($query) use ($user, $email) {
                $query->where('user_id', $user->id);

                if ($email !== '') {
                    $query->orWhere('email', $email);
                }
            })
            ->exists();
    }

    protected function userCanManageEvent(User $user, CalendarEvent $calendarEvent): bool
    {
        if ($user->role === 'admin') {
            return true;
        }

        $email = strtolower(trim((string) $user->email));
        $ownerEmail = strtolower(trim((string) $calendarEvent->created_by));

        return $email !== '' && $ownerEmail !== '' && $email === $ownerEmail;
    }

    protected function wasScheduleChanged(CalendarEvent $calendarEvent, array $validated): bool
    {
        if (array_key_exists('start_at', $validated)) {
            if (! $calendarEvent->start_at->equalTo(Carbon::parse($validated['start_at']))) {
                return true;
            }
        }

        if (array_key_exists('end_at', $validated)) {
            if (! $calendarEvent->end_at->equalTo(Carbon::parse($validated['end_at']))) {
                return true;
            }
        }

        if (array_key_exists('is_all_day', $validated)) {
            if ((bool) $validated['is_all_day'] !== (bool) $calendarEvent->is_all_day) {
                return true;
            }
        }

        return false;
    }

    protected function normalizeAttendeeEmails(?array $emails): ?array
    {
        if ($emails === null) {
            return null;
        }

        $normalized = collect($emails)
            ->map(fn ($email) => strtolower(trim((string) $email)))
            ->filter()
            ->unique()
            ->values()
            ->all();

        return count($normalized) > 0 ? $normalized : null;
    }

    protected function withGoogleCalendarUrl(array $payload, ?CalendarEvent $calendarEvent = null): array
    {
        if ($calendarEvent) {
            $data = array_merge($calendarEvent->toArray(), $payload);
        } else {
            $data = $payload;
        }

        $payload['google_calendar_url'] = $this->buildGoogleCalendarUrl($data);

        return $payload;
    }

    protected function buildGoogleCalendarUrl(array $data): string
    {
        $title = (string) ($data['title'] ?? 'Event');
        $description = (string) ($data['description'] ?? '');
        $location = (string) ($data['location'] ?? '');
        $isAllDay = (bool) ($data['is_all_day'] ?? false);

        $startAt = Carbon::parse($data['start_at']);
        $endAt = Carbon::parse($data['end_at']);

        if ($isAllDay) {
            $dateRange = $startAt->format('Ymd') . '/' . $endAt->copy()->addDay()->format('Ymd');
        } else {
            $dateRange = $startAt->utc()->format('Ymd\\THis\\Z') . '/' . $endAt->utc()->format('Ymd\\THis\\Z');
        }

        $params = [
            'action' => 'TEMPLATE',
            'text' => $title,
            'dates' => $dateRange,
            'details' => $description,
            'location' => $location,
        ];

        if (! empty($data['attendee_emails']) && is_array($data['attendee_emails'])) {
            $params['add'] = implode(',', $data['attendee_emails']);
        }

        return 'https://calendar.google.com/calendar/render?' . http_build_query($params);
    }
}
