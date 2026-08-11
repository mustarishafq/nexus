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
use App\Services\CalendarEventRecurrenceService;
use App\Support\ApiTokenAuth;
use App\Support\CalendarEventCheckInForm;
use App\Support\SyncAssignmentRecords;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CalendarEventController extends Controller
{
    use AppliesIndexQuery;

    public function __construct(
        protected CalendarEventRecurrenceService $recurrenceService,
    ) {}

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
            'check_in_form_fields' => ['sometimes', 'nullable', 'array', 'max:'.CalendarEventCheckInForm::MAX_FIELDS],
            'check_in_form_audience' => ['sometimes', 'nullable', Rule::in([
                CalendarEventCheckInForm::AUDIENCE_PUBLIC,
                CalendarEventCheckInForm::AUDIENCE_EVERYONE,
            ])],
            'is_all_day' => ['sometimes', 'boolean'],
            'attendee_emails' => ['nullable', 'array'],
            'attendee_emails.*' => ['email:rfc'],
            'recurrence_frequency' => ['nullable', Rule::in(['daily', 'weekly', 'monthly'])],
            'recurrence_end_date' => ['nullable', 'date'],
            'recurrence_count' => ['nullable', 'integer', 'min:1'],
            'series_share_qr' => ['sometimes', 'boolean'],
            'recurrence_month_mode' => ['nullable', Rule::in(['same_day', 'first_day', 'last_day', 'day_of_month'])],
            'recurrence_month_day' => ['nullable', 'integer', 'min:1', 'max:31'],
            'recurrence_weekday' => ['nullable', 'integer', 'min:0', 'max:6'],
        ]);

        $frequency = $validated['recurrence_frequency'] ?? null;
        $hasEndDate = ! empty($validated['recurrence_end_date']);
        $hasCount = array_key_exists('recurrence_count', $validated) && $validated['recurrence_count'] !== null;
        $shareQr = $frequency ? (bool) ($validated['series_share_qr'] ?? false) : false;
        $monthMode = $frequency === 'monthly'
            ? ($validated['recurrence_month_mode'] ?? 'same_day')
            : null;
        $monthDay = $monthMode === 'day_of_month'
            ? (int) ($validated['recurrence_month_day'] ?? 0)
            : null;
        $weekday = $frequency === 'weekly'
            ? (array_key_exists('recurrence_weekday', $validated) && $validated['recurrence_weekday'] !== null
                ? (int) $validated['recurrence_weekday']
                : Carbon::parse($validated['start_at'])->dayOfWeek)
            : null;

        if (! $frequency && ($hasEndDate || $hasCount)) {
            throw ValidationException::withMessages([
                'recurrence_frequency' => ['recurrence_frequency is required when recurrence_end_date or recurrence_count is set.'],
            ]);
        }

        // End date / count are ignored for rolling recurrence (next event is created after the current one ends).
        unset($validated['recurrence_end_date'], $validated['recurrence_count']);

        if ($frequency === 'weekly' && ($weekday < 0 || $weekday > 6)) {
            throw ValidationException::withMessages([
                'recurrence_weekday' => ['Choose a weekday between Sunday (0) and Saturday (6).'],
            ]);
        }

        if ($frequency === 'monthly' && $monthMode === 'day_of_month' && ($monthDay < 1 || $monthDay > 31)) {
            throw ValidationException::withMessages([
                'recurrence_month_day' => ['Choose a day of the month between 1 and 31.'],
            ]);
        }

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
        $validated['check_in_form_fields'] = array_key_exists('check_in_form_fields', $validated)
            ? CalendarEventCheckInForm::normalizeFields($validated['check_in_form_fields'] ?? [])
            : CalendarEventCheckInForm::defaultFields();
        $validated['check_in_form_audience'] = CalendarEventCheckInForm::normalizeAudience(
            $validated['check_in_form_audience'] ?? null
        );
        $attendeeEmails = $this->normalizeAttendeeEmails($validated['attendee_emails'] ?? null);
        unset(
            $validated['attendee_emails'],
            $validated['recurrence_frequency'],
            $validated['series_share_qr'],
            $validated['recurrence_month_mode'],
            $validated['recurrence_month_day'],
            $validated['recurrence_weekday'],
        );

        $baseStart = Carbon::parse($validated['start_at']);
        $baseEnd = Carbon::parse($validated['end_at']);
        $durationSeconds = max(0, $baseEnd->getTimestamp() - $baseStart->getTimestamp());
        $checkInOpensAt = ! empty($validated['check_in_opens_at'])
            ? Carbon::parse($validated['check_in_opens_at'])
            : null;
        $checkInOffsetSeconds = $checkInOpensAt
            ? $checkInOpensAt->getTimestamp() - $baseStart->getTimestamp()
            : null;

        $occurrenceStart = $frequency
            ? $this->recurrenceService->alignFirstStart(
                $baseStart,
                $frequency,
                $monthMode,
                $monthDay,
                $weekday,
            )
            : $baseStart->copy();

        $occurrenceEnd = $occurrenceStart->copy()->addSeconds($durationSeconds);
        $occurrenceCheckInOpensAt = $checkInOffsetSeconds !== null
            ? $occurrenceStart->copy()->addSeconds($checkInOffsetSeconds)
            : null;

        $seriesId = $frequency ? (string) Str::uuid() : null;
        $sharedCheckInToken = ($frequency && $shareQr) ? (string) Str::uuid() : null;

        $item = DB::transaction(function () use (
            $validated,
            $attendeeEmails,
            $occurrenceStart,
            $occurrenceEnd,
            $occurrenceCheckInOpensAt,
            $frequency,
            $seriesId,
            $shareQr,
            $monthMode,
            $monthDay,
            $weekday,
            $sharedCheckInToken,
        ) {
            $occurrencePayload = array_merge($validated, [
                'start_at' => $occurrenceStart->toIso8601String(),
                'end_at' => $occurrenceEnd->toIso8601String(),
                'check_in_opens_at' => $occurrenceCheckInOpensAt?->toIso8601String(),
                'series_id' => $seriesId,
                'recurrence_frequency' => $frequency,
                'series_index' => $seriesId !== null ? 0 : null,
                'series_share_qr' => $shareQr,
                'recurrence_month_mode' => $monthMode,
                'recurrence_month_day' => $monthDay,
                'recurrence_weekday' => $weekday,
            ]);

            if ($sharedCheckInToken) {
                $occurrencePayload['check_in_token'] = $sharedCheckInToken;
            }

            $payload = $this->withGoogleCalendarUrl(array_merge($occurrencePayload, [
                'attendee_emails' => $attendeeEmails,
            ]));

            $created = CalendarEvent::create(array_merge(
                collect($payload)->except(['attendee_emails'])->all(),
                [
                    'google_sync_status' => 'pending',
                    'google_sync_error' => null,
                ]
            ));

            SyncAssignmentRecords::syncCalendarEventAttendees($created, $attendeeEmails);

            return $created;
        });

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
            'check_in_form_fields' => ['sometimes', 'nullable', 'array', 'max:'.CalendarEventCheckInForm::MAX_FIELDS],
            'check_in_form_audience' => ['sometimes', 'nullable', Rule::in([
                CalendarEventCheckInForm::AUDIENCE_PUBLIC,
                CalendarEventCheckInForm::AUDIENCE_EVERYONE,
            ])],
            'is_all_day' => ['sometimes', 'boolean'],
            'attendee_emails' => ['sometimes', 'nullable', 'array'],
            'attendee_emails.*' => ['email:rfc'],
        ]);

        $attendeeEmails = null;
        if (array_key_exists('attendee_emails', $validated)) {
            $attendeeEmails = $this->normalizeAttendeeEmails($validated['attendee_emails']);
        }
        unset($validated['attendee_emails']);

        if (array_key_exists('check_in_form_fields', $validated)) {
            $validated['check_in_form_fields'] = CalendarEventCheckInForm::normalizeFields(
                $validated['check_in_form_fields'] ?? []
            );
        }

        if (array_key_exists('check_in_form_audience', $validated)) {
            $validated['check_in_form_audience'] = CalendarEventCheckInForm::normalizeAudience(
                $validated['check_in_form_audience']
            );
        }

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
        $data['check_in_form_fields'] = CalendarEventCheckInForm::fieldsForEvent($event->check_in_form_fields);
        $data['check_in_form_audience'] = CalendarEventCheckInForm::audienceForEvent($event->check_in_form_audience);

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
