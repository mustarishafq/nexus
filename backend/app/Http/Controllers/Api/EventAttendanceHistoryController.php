<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AuthorizesRoles;
use App\Http\Controllers\Controller;
use App\Models\CalendarEventAttendance;
use App\Models\User;
use App\Services\PermissionService;
use App\Support\PermissionCatalog;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Cross-event attendance history: a user's own event check-ins, and an
 * organization-wide report (filterable by user) for HR / calendar managers.
 */
class EventAttendanceHistoryController extends Controller
{
    use AuthorizesRoles;

    public function myHistory(Request $request): JsonResponse
    {
        $user = $this->authenticatedUser($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'search' => ['nullable', 'string', 'max:255'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:200'],
            'offset' => ['nullable', 'integer', 'min:0'],
        ]);

        $query = $this->baseQuery();
        $this->scopeToUser($query, $user);
        $this->applyDateFilters($query, $validated);

        if (! empty($validated['search'])) {
            $term = '%'.mb_strtolower(trim($validated['search'])).'%';
            $query->whereHas('calendarEvent', fn (Builder $q) => $q->whereRaw('LOWER(title) LIKE ?', [$term]));
        }

        $total = (clone $query)->count();
        $limit = $validated['limit'] ?? 50;
        $offset = $validated['offset'] ?? 0;

        $records = $query
            ->orderByDesc('checked_in_at')
            ->orderByDesc('id')
            ->offset($offset)
            ->limit($limit)
            ->get();

        return response()->json([
            'records' => $records->map(fn (CalendarEventAttendance $a) => $this->serialize($a))->values(),
            'total' => $total,
            'pagination' => ['limit' => $limit, 'offset' => $offset],
        ]);
    }

    public function report(Request $request): JsonResponse
    {
        if ($response = $this->authorizeReport($request)) {
            return $response;
        }

        $validated = $this->validateReportFilters($request, true);

        $query = $this->baseQuery();
        $this->applyReportFilters($query, $validated);

        $summaryRow = (clone $query)
            ->toBase()
            ->selectRaw('COUNT(*) as total')
            ->selectRaw('COUNT(DISTINCT calendar_event_id) as unique_events')
            ->selectRaw('COUNT(DISTINCT LOWER(email)) as unique_attendees')
            ->selectRaw('SUM(CASE WHEN user_id IS NOT NULL THEN 1 ELSE 0 END) as staff')
            ->selectRaw('SUM(CASE WHEN user_id IS NULL THEN 1 ELSE 0 END) as public_count')
            ->first();

        $limit = $validated['limit'] ?? 50;
        $offset = $validated['offset'] ?? 0;

        $records = $query
            ->orderByDesc('checked_in_at')
            ->orderByDesc('id')
            ->offset($offset)
            ->limit($limit)
            ->get();

        return response()->json([
            'records' => $records->map(fn (CalendarEventAttendance $a) => $this->serialize($a))->values(),
            'summary' => [
                'total' => (int) ($summaryRow->total ?? 0),
                'unique_events' => (int) ($summaryRow->unique_events ?? 0),
                'unique_attendees' => (int) ($summaryRow->unique_attendees ?? 0),
                'staff' => (int) ($summaryRow->staff ?? 0),
                'public' => (int) ($summaryRow->public_count ?? 0),
            ],
            'pagination' => ['limit' => $limit, 'offset' => $offset],
        ]);
    }

    public function exportCsv(Request $request): StreamedResponse|JsonResponse
    {
        if ($response = $this->authorizeReport($request)) {
            return $response;
        }

        $validated = $this->validateReportFilters($request, false);

        $query = $this->baseQuery();
        $this->applyReportFilters($query, $validated);
        $query->orderByDesc('checked_in_at')->orderByDesc('id');

        $filename = 'event-attendance-report-'.now()->format('Y-m-d-His').'.csv';

        return response()->streamDownload(function () use ($query) {
            $handle = fopen('php://output', 'w');

            fputcsv($handle, [
                'Name',
                'Email',
                'Type',
                'Department',
                'Event',
                'Event start',
                'Location',
                'Source',
                'Checked in at',
            ]);

            foreach ($query->lazy(500) as $attendance) {
                $event = $attendance->calendarEvent;

                fputcsv($handle, [
                    $this->attendeeName($attendance) ?? '',
                    $attendance->email,
                    $attendance->user_id !== null ? 'Staff' : 'Public',
                    $attendance->user?->department?->name ?? '',
                    $event?->title ?? '',
                    $event?->start_at?->toIso8601String() ?? '',
                    $event?->location ?? '',
                    $attendance->source,
                    $attendance->checked_in_at?->toIso8601String(),
                ]);
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    protected function authorizeReport(Request $request): ?JsonResponse
    {
        $user = $this->authenticatedUser($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (! $this->canViewReport($user)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return null;
    }

    protected function canViewReport(User $user): bool
    {
        return PermissionService::can($user, PermissionCatalog::ATTENDANCE_VIEW_ALL)
            || PermissionService::can($user, PermissionCatalog::CALENDAR_MANAGE);
    }

    /**
     * @return array<string, mixed>
     */
    protected function validateReportFilters(Request $request, bool $withPagination): array
    {
        $rules = [
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'type' => ['nullable', 'in:staff,public'],
            'search' => ['nullable', 'string', 'max:255'],
        ];

        if ($withPagination) {
            $rules['limit'] = ['nullable', 'integer', 'min:1', 'max:500'];
            $rules['offset'] = ['nullable', 'integer', 'min:0'];
        }

        return $request->validate($rules);
    }

    /**
     * @return Builder<CalendarEventAttendance>
     */
    protected function baseQuery(): Builder
    {
        return CalendarEventAttendance::query()
            ->with([
                'calendarEvent:id,title,location,start_at,end_at,is_all_day,series_id,created_by',
                'user:id,name,full_name,email,profile_picture,department_id',
                'user.department:id,name',
            ]);
    }

    /**
     * Match by linked user id, or by email for check-ins made before the
     * account was linked (e.g. public form).
     *
     * @param  Builder<CalendarEventAttendance>  $query
     */
    protected function scopeToUser(Builder $query, User $user): void
    {
        $email = mb_strtolower(trim((string) $user->email));

        $query->where(function (Builder $q) use ($user, $email) {
            $q->where('user_id', $user->id);

            if ($email !== '') {
                $q->orWhereRaw('LOWER(email) = ?', [$email]);
            }
        });
    }

    /**
     * @param  Builder<CalendarEventAttendance>  $query
     * @param  array<string, mixed>  $filters
     */
    protected function applyDateFilters(Builder $query, array $filters): void
    {
        if (! empty($filters['date_from'])) {
            $query->where('checked_in_at', '>=', Carbon::parse($filters['date_from'])->startOfDay());
        }

        if (! empty($filters['date_to'])) {
            $query->where('checked_in_at', '<=', Carbon::parse($filters['date_to'])->endOfDay());
        }
    }

    /**
     * @param  Builder<CalendarEventAttendance>  $query
     * @param  array<string, mixed>  $filters
     */
    protected function applyReportFilters(Builder $query, array $filters): void
    {
        $this->applyDateFilters($query, $filters);

        if (! empty($filters['user_id'])) {
            $target = User::query()->find((int) $filters['user_id']);
            if ($target) {
                $this->scopeToUser($query, $target);
            }
        }

        if (! empty($filters['department_id'])) {
            $query->whereHas(
                'user',
                fn (Builder $q) => $q->where('department_id', (int) $filters['department_id'])
            );
        }

        if (($filters['type'] ?? null) === 'staff') {
            $query->whereNotNull('user_id');
        } elseif (($filters['type'] ?? null) === 'public') {
            $query->whereNull('user_id');
        }

        if (! empty($filters['search'])) {
            $term = '%'.mb_strtolower(trim($filters['search'])).'%';
            $query->where(function (Builder $q) use ($term) {
                $q->whereRaw('LOWER(email) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(display_name) LIKE ?', [$term])
                    ->orWhereHas('calendarEvent', fn (Builder $e) => $e->whereRaw('LOWER(title) LIKE ?', [$term]));
            });
        }
    }

    protected function attendeeName(CalendarEventAttendance $attendance): ?string
    {
        return $attendance->display_name
            ?: $attendance->user?->full_name
            ?: $attendance->user?->name
            ?: null;
    }

    /**
     * @return array<string, mixed>
     */
    protected function serialize(CalendarEventAttendance $attendance): array
    {
        $event = $attendance->calendarEvent;
        $user = $attendance->user;

        return [
            'id' => $attendance->id,
            'email' => $attendance->email,
            'display_name' => $this->attendeeName($attendance),
            'user_id' => $attendance->user_id,
            'is_staff' => $attendance->user_id !== null,
            'source' => $attendance->source,
            'checked_in_at' => $attendance->checked_in_at?->toISOString(),
            'user' => $user ? [
                'id' => $user->id,
                'name' => $user->full_name ?: $user->name,
                'email' => $user->email,
                'profile_picture' => $user->profile_picture,
                'department' => $user->department?->name,
            ] : null,
            'event' => $event ? [
                'id' => $event->id,
                'title' => $event->title,
                'location' => $event->location,
                'start_at' => $event->start_at?->toISOString(),
                'end_at' => $event->end_at?->toISOString(),
                'is_all_day' => (bool) $event->is_all_day,
                'series_id' => $event->series_id,
            ] : null,
        ];
    }
}
