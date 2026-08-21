<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CalendarEvent;
use App\Models\CalendarEventAttendance;
use App\Models\User;
use App\Services\GamificationService;
use App\Services\PermissionService;
use App\Support\ApiTokenAuth;
use App\Support\CalendarEventCheckInForm;
use App\Support\PermissionCatalog;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Symfony\Component\HttpFoundation\StreamedResponse;

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
            'answers' => ['sometimes', 'nullable', 'array'],
        ]);

        $email = strtolower(trim($validated['email']));
        $answers = CalendarEventCheckInForm::validateAnswers(
            CalendarEventCheckInForm::fieldsForEvent($event->check_in_form_fields),
            $validated['answers'] ?? [],
            $validated['name'] ?? null,
        );

        $user = User::query()
            ->whereRaw('LOWER(email) = ?', [$email])
            ->first();

        $displayName = CalendarEventCheckInForm::displayNameFromAnswers(
            $answers,
            $user?->full_name ?? $user?->name
        );

        return $this->createAttendance(
            $event,
            $email,
            $user?->id,
            $displayName,
            CalendarEventAttendance::SOURCE_PUBLIC_FORM,
            $answers,
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

        $request->validate([
            'answers' => ['sometimes', 'nullable', 'array'],
        ]);

        $audience = CalendarEventCheckInForm::audienceForEvent($event->check_in_form_audience);
        $answers = [];

        if (CalendarEventCheckInForm::requiresAnswersForStaff($audience)) {
            $answers = CalendarEventCheckInForm::validateAnswers(
                CalendarEventCheckInForm::fieldsForEvent($event->check_in_form_fields),
                $request->input('answers'),
            );
        }

        $displayName = CalendarEventCheckInForm::displayNameFromAnswers(
            $answers,
            $user->full_name ?: $user->name
        );

        return $this->createAttendance(
            $event,
            $email,
            $user->id,
            $displayName,
            CalendarEventAttendance::SOURCE_IN_APP,
            $answers,
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
                'form_answers' => is_array($attendance->form_answers) ? $attendance->form_answers : [],
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
            'check_in_form' => CalendarEventCheckInForm::present(
                $calendarEvent->check_in_form_fields,
                $calendarEvent->check_in_form_audience,
            ),
            'attendances' => $attendances,
        ]);
    }

    public function seriesOccurrences(Request $request, CalendarEvent $calendarEvent): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (! $this->userCanManageEvent($user, $calendarEvent)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if (! $calendarEvent->series_id) {
            return response()->json([
                'series_id' => null,
                'current_event_id' => $calendarEvent->id,
                'occurrences' => [],
            ]);
        }

        $occurrences = CalendarEvent::query()
            ->where('series_id', $calendarEvent->series_id)
            ->withCount('checkIns')
            ->orderBy('series_index')
            ->orderBy('start_at')
            ->get()
            ->map(fn (CalendarEvent $event) => [
                'id' => $event->id,
                'title' => $event->title,
                'start_at' => $event->start_at?->toISOString(),
                'end_at' => $event->end_at?->toISOString(),
                'is_all_day' => (bool) $event->is_all_day,
                'series_index' => $event->series_index,
                'attendance_count' => (int) $event->check_ins_count,
            ])
            ->values()
            ->all();

        return response()->json([
            'series_id' => $calendarEvent->series_id,
            'current_event_id' => $calendarEvent->id,
            'occurrences' => $occurrences,
        ]);
    }

    public function exportCsv(Request $request, CalendarEvent $calendarEvent): StreamedResponse|JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (! $this->userCanManageEvent($user, $calendarEvent)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $query = $calendarEvent->checkIns()
            ->with('user:id,name,full_name,email')
            ->orderBy('checked_in_at');

        $extraFields = CalendarEventCheckInForm::extraColumns(
            CalendarEventCheckInForm::fieldsForEvent($calendarEvent->check_in_form_fields)
        );

        $safeTitle = preg_replace('/[^A-Za-z0-9_\-]+/', '-', (string) $calendarEvent->title) ?: 'event';
        $filename = 'event-attendance-'.$safeTitle.'-'.now()->format('Y-m-d-His').'.csv';

        return response()->streamDownload(function () use ($query, $extraFields) {
            $handle = fopen('php://output', 'w');

            $headers = [
                'Name',
                'Email',
                'Type',
                'Source',
                'Checked in at',
            ];

            foreach ($extraFields as $field) {
                $headers[] = $field['label'];
            }

            fputcsv($handle, $headers);

            foreach ($query->lazy(500) as $attendance) {
                $name = $attendance->display_name
                    ?: $attendance->user?->full_name
                    ?: $attendance->user?->name
                    ?: '';

                $answers = is_array($attendance->form_answers) ? $attendance->form_answers : [];

                $row = [
                    $name,
                    $attendance->email,
                    $attendance->user_id !== null ? 'Staff' : 'Public',
                    $attendance->source,
                    $attendance->checked_in_at?->toIso8601String(),
                ];

                foreach ($extraFields as $field) {
                    $row[] = CalendarEventCheckInForm::formatAnswer($answers[$field['key']] ?? null);
                }

                fputcsv($handle, $row);
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    protected function findEventByToken(string $token): ?CalendarEvent
    {
        $token = trim($token);

        if ($token === '') {
            return null;
        }

        $events = CalendarEvent::query()
            ->where('check_in_token', $token)
            ->orderBy('start_at')
            ->get();

        if ($events->isEmpty()) {
            return null;
        }

        if ($events->count() === 1) {
            return $events->first();
        }

        return $this->resolveSharedTokenOccurrence($events);
    }

    /**
     * @param  \Illuminate\Support\Collection<int, CalendarEvent>  $events
     */
    protected function resolveSharedTokenOccurrence($events): CalendarEvent
    {
        $now = Carbon::now();

        $openNow = $events->first(function (CalendarEvent $event) use ($now) {
            if (! $event->isAttendanceOpen($now)) {
                return false;
            }

            return ! $event->end_at || $event->end_at->greaterThanOrEqualTo($now);
        });

        if ($openNow) {
            return $openNow;
        }

        $today = $events->first(function (CalendarEvent $event) use ($now) {
            return $event->start_at && $event->start_at->isSameDay($now);
        });

        if ($today) {
            return $today;
        }

        $upcoming = $events
            ->filter(fn (CalendarEvent $event) => $event->end_at && $event->end_at->greaterThanOrEqualTo($now))
            ->sortBy('start_at')
            ->first();

        if ($upcoming) {
            return $upcoming;
        }

        return $events->sortByDesc('start_at')->first();
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
            'check_in_form' => CalendarEventCheckInForm::present(
                $event->check_in_form_fields,
                $event->check_in_form_audience,
            ),
        ];
    }

    protected function createAttendance(
        CalendarEvent $event,
        string $email,
        ?int $userId,
        ?string $displayName,
        string $source,
        array $formAnswers = [],
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
                'form_answers' => $formAnswers === [] ? null : $formAnswers,
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

        $payload = [
            'message' => 'Checked in successfully.',
            'attendance' => $this->presentAttendance($attendance),
            'event' => [
                'title' => $event->title,
                'location' => $event->location,
                'start_at' => $event->start_at?->toISOString(),
                'end_at' => $event->end_at?->toISOString(),
            ],
        ];

        if ($userId) {
            $user = User::query()->find($userId);
            if ($user) {
                $offer = app(GamificationService::class)->offer(
                    $user,
                    'event_check_in',
                    'calendar_event_attendance',
                    $attendance->id,
                );
                $payload = array_merge($payload, app(GamificationService::class)->offerPayload($offer));
            }
        }

        return response()->json($payload, 201);
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
            'form_answers' => is_array($attendance->form_answers) ? $attendance->form_answers : [],
        ];
    }

    protected function userCanManageEvent(User $user, CalendarEvent $calendarEvent): bool
    {
        if (PermissionService::can($user, PermissionCatalog::CALENDAR_MANAGE)) {
            return true;
        }

        $email = strtolower(trim((string) $user->email));
        $ownerEmail = strtolower(trim((string) $calendarEvent->created_by));

        return $email !== '' && $ownerEmail !== '' && $email === $ownerEmail;
    }
}
