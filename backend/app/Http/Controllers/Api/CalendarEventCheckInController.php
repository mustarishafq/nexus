<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CalendarEvent;
use App\Models\CalendarEventAttendance;
use App\Models\User;
use App\Support\ApiTokenAuth;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class CalendarEventCheckInController extends Controller
{
    public function show(string $token): JsonResponse
    {
        $event = $this->findEventByToken($token);

        if (! $event) {
            return response()->json(['message' => 'Event check-in not found.'], 404);
        }

        return response()->json($this->presentPublicEvent($event));
    }

    public function store(Request $request, string $token): JsonResponse
    {
        $event = $this->findEventByToken($token);

        if (! $event) {
            return response()->json(['message' => 'Event check-in not found.'], 404);
        }

        if ($blocked = $this->attendanceNotOpenResponse($event)) {
            return $blocked;
        }

        $validated = $request->validate([
            'email' => ['required', 'email:rfc', 'max:255'],
            'name' => ['nullable', 'string', 'max:255'],
        ]);

        $email = strtolower(trim($validated['email']));
        $displayName = isset($validated['name']) ? trim((string) $validated['name']) : null;
        $displayName = $displayName !== '' ? $displayName : null;

        $user = User::query()
            ->whereRaw('LOWER(email) = ?', [$email])
            ->first();

        return $this->createAttendance(
            $event,
            $email,
            $user?->id,
            $displayName ?? $user?->full_name ?? $user?->name,
            CalendarEventAttendance::SOURCE_PUBLIC_FORM
        );
    }

    public function storeForMe(Request $request, string $token): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $event = $this->findEventByToken($token);

        if (! $event) {
            return response()->json(['message' => 'Event check-in not found.'], 404);
        }

        if ($blocked = $this->attendanceNotOpenResponse($event)) {
            return $blocked;
        }

        $email = strtolower(trim((string) $user->email));

        if ($email === '') {
            return response()->json(['message' => 'Your account does not have an email address.'], 422);
        }

        return $this->createAttendance(
            $event,
            $email,
            $user->id,
            $user->full_name ?: $user->name,
            CalendarEventAttendance::SOURCE_IN_APP
        );
    }

    public function index(Request $request, CalendarEvent $calendarEvent): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (! $this->userCanManageEvent($user, $calendarEvent)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $attendances = $calendarEvent->checkIns()
            ->with('user:id,name,full_name,email,profile_picture')
            ->orderBy('checked_in_at')
            ->get()
            ->map(fn (CalendarEventAttendance $attendance) => [
                'id' => $attendance->id,
                'email' => $attendance->email,
                'display_name' => $attendance->display_name,
                'user_id' => $attendance->user_id,
                'is_staff' => $attendance->user_id !== null,
                'source' => $attendance->source,
                'checked_in_at' => $attendance->checked_in_at?->toISOString(),
                'user' => $attendance->user ? [
                    'id' => $attendance->user->id,
                    'name' => $attendance->user->full_name ?: $attendance->user->name,
                    'email' => $attendance->user->email,
                    'profile_picture' => $attendance->user->profile_picture,
                ] : null,
            ]);

        return response()->json([
            'event_id' => $calendarEvent->id,
            'count' => $attendances->count(),
            'attendances' => $attendances,
        ]);
    }

    protected function findEventByToken(string $token): ?CalendarEvent
    {
        $token = trim($token);

        if ($token === '') {
            return null;
        }

        return CalendarEvent::query()
            ->where('check_in_token', $token)
            ->first();
    }

    protected function attendanceNotOpenResponse(CalendarEvent $event): ?JsonResponse
    {
        if ($event->isAttendanceOpen()) {
            return null;
        }

        return response()->json([
            'message' => 'Attendance is not open yet.',
            'code' => 'attendance_not_open',
            'check_in_opens_at' => $event->check_in_opens_at?->toISOString(),
            'event' => $this->presentPublicEvent($event),
        ], 403);
    }

    /**
     * @return array<string, mixed>
     */
    protected function presentPublicEvent(CalendarEvent $event): array
    {
        $open = $event->isAttendanceOpen();

        return [
            'title' => $event->title,
            'location' => $event->location,
            'start_at' => $event->start_at?->toISOString(),
            'end_at' => $event->end_at?->toISOString(),
            'is_all_day' => (bool) $event->is_all_day,
            'check_in_opens_at' => $event->check_in_opens_at?->toISOString(),
            'attendance_open' => $open,
        ];
    }

    protected function createAttendance(
        CalendarEvent $event,
        string $email,
        ?int $userId,
        ?string $displayName,
        string $source,
    ): JsonResponse {
        $existing = CalendarEventAttendance::query()
            ->where('calendar_event_id', $event->id)
            ->where('email', $email)
            ->first();

        if ($existing) {
            return response()->json([
                'message' => 'Already checked in for this event.',
                'attendance' => $this->presentAttendance($existing),
            ], 409);
        }

        try {
            $attendance = CalendarEventAttendance::create([
                'calendar_event_id' => $event->id,
                'email' => $email,
                'user_id' => $userId,
                'display_name' => $displayName,
                'source' => $source,
                'checked_in_at' => Carbon::now(),
            ]);
        } catch (QueryException $exception) {
            $existing = CalendarEventAttendance::query()
                ->where('calendar_event_id', $event->id)
                ->where('email', $email)
                ->first();

            if ($existing) {
                return response()->json([
                    'message' => 'Already checked in for this event.',
                    'attendance' => $this->presentAttendance($existing),
                ], 409);
            }

            throw $exception;
        }

        return response()->json([
            'message' => 'Checked in successfully.',
            'attendance' => $this->presentAttendance($attendance),
            'event' => [
                'title' => $event->title,
                'location' => $event->location,
                'start_at' => $event->start_at?->toISOString(),
                'end_at' => $event->end_at?->toISOString(),
            ],
        ], 201);
    }

    /**
     * @return array<string, mixed>
     */
    protected function presentAttendance(CalendarEventAttendance $attendance): array
    {
        return [
            'id' => $attendance->id,
            'email' => $attendance->email,
            'display_name' => $attendance->display_name,
            'user_id' => $attendance->user_id,
            'is_staff' => $attendance->user_id !== null,
            'source' => $attendance->source,
            'checked_in_at' => $attendance->checked_in_at?->toISOString(),
        ];
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
}
