<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AppliesIndexQuery;
use App\Http\Controllers\Controller;
use App\Models\CalendarEvent;
use App\Models\User;
use App\Services\GoogleCalendarService;
use App\Support\ApiTokenAuth;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class CalendarEventController extends Controller
{
    use AppliesIndexQuery;

    protected GoogleCalendarService $googleCalendarService;

    public function __construct(GoogleCalendarService $googleCalendarService)
    {
        $this->googleCalendarService = $googleCalendarService;
    }

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

        return response()->json($query->get());
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
            'is_all_day' => ['sometimes', 'boolean'],
            'attendee_emails' => ['nullable', 'array'],
            'attendee_emails.*' => ['email:rfc'],
        ]);

        $validated['created_by'] = $user->email;
        $validated['attendee_emails'] = $this->normalizeAttendeeEmails($validated['attendee_emails'] ?? null);

        $payload = $this->withGoogleCalendarUrl($validated);

        $item = CalendarEvent::create(array_merge($payload, [
            'google_sync_status' => 'pending',
            'google_sync_error' => null,
        ]));

        $this->syncToGoogle($item);

        return response()->json($item->fresh(), 201);
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

        return response()->json($calendarEvent);
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
            'is_all_day' => ['sometimes', 'boolean'],
            'attendee_emails' => ['sometimes', 'nullable', 'array'],
            'attendee_emails.*' => ['email:rfc'],
        ]);

        if (array_key_exists('attendee_emails', $validated)) {
            $validated['attendee_emails'] = $this->normalizeAttendeeEmails($validated['attendee_emails']);
        }

        $startAt = array_key_exists('start_at', $validated) ? $validated['start_at'] : $calendarEvent->start_at;
        $endAt = array_key_exists('end_at', $validated) ? $validated['end_at'] : $calendarEvent->end_at;

        if ($startAt && $endAt && Carbon::parse($endAt)->lt(Carbon::parse($startAt))) {
            return response()->json([
                'message' => 'The end_at must be a date after or equal to start_at.',
                'errors' => [
                    'end_at' => ['The end_at must be a date after or equal to start_at.'],
                ],
            ], 422);
        }

        $payload = $this->withGoogleCalendarUrl($validated, $calendarEvent);

        $calendarEvent->update($payload);

        $this->syncToGoogle($calendarEvent);

        return response()->json($calendarEvent->fresh());
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

        $this->googleCalendarService->deleteEvent($calendarEvent);

        $calendarEvent->delete();

        return response()->json(null, 204);
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

        return CalendarEvent::query()->where(function ($query) use ($email) {
            $query
                ->whereRaw('LOWER(created_by) = ?', [$email])
                ->orWhereJsonContains('attendee_emails', $email)
                ->orWhere(function ($legacyAttendees) use ($email) {
                    $legacyAttendees
                        ->whereNotNull('attendee_emails')
                        ->where('attendee_emails', '!=', '[]')
                        ->whereRaw('LOWER(CAST(attendee_emails AS CHAR)) LIKE ?', ['%"'.$email.'"%']);
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

        $attendees = collect($calendarEvent->attendee_emails ?? [])
            ->map(fn ($value) => strtolower(trim((string) $value)))
            ->filter()
            ->all();

        return in_array($email, $attendees, true);
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

    protected function syncToGoogle(CalendarEvent $calendarEvent): void
    {
        $result = $this->googleCalendarService->syncEvent($calendarEvent);

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
