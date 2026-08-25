<?php

namespace App\Services;

use App\Models\CalendarEvent;
use App\Support\SyncAssignmentRecords;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CalendarEventRecurrenceService
{
    public function alignFirstStart(
        Carbon $baseStart,
        string $frequency,
        ?string $monthMode = null,
        ?int $monthDay = null,
        ?int $weekday = null,
    ): Carbon {
        return match ($frequency) {
            'monthly' => $this->alignMonthlyStart($baseStart, $monthMode ?? 'same_day', $monthDay),
            'weekly' => $this->alignWeeklyStart($baseStart, $weekday ?? $baseStart->dayOfWeek),
            default => $baseStart->copy(),
        };
    }

    public function nextStartFrom(CalendarEvent $event): Carbon
    {
        $frequency = (string) $event->recurrence_frequency;
        $cursor = $event->start_at->copy();

        return $this->advanceOccurrence(
            $cursor,
            $frequency,
            $event->recurrence_month_mode,
            $event->recurrence_month_day !== null ? (int) $event->recurrence_month_day : null,
        );
    }

    /**
     * Create the next series occurrence when the latest one has ended.
     */
    public function spawnNextIfDue(CalendarEvent $event, ?Carbon $now = null): ?CalendarEvent
    {
        $now ??= Carbon::now();

        if (! $event->series_id || ! $event->recurrence_frequency) {
            return null;
        }

        if (! $event->end_at || $event->end_at->greaterThan($now)) {
            return null;
        }

        $latestIndex = CalendarEvent::query()
            ->where('series_id', $event->series_id)
            ->max('series_index');

        if ((int) $event->series_index !== (int) $latestIndex) {
            return null;
        }

        $exists = CalendarEvent::query()
            ->where('series_id', $event->series_id)
            ->where('series_index', ((int) $event->series_index) + 1)
            ->exists();

        if ($exists) {
            return null;
        }

        return $this->createNextOccurrence($event);
    }

    public function createNextOccurrence(CalendarEvent $event): CalendarEvent
    {
        $event->loadMissing('attendees');

        $nextStart = $this->nextStartFrom($event);
        $durationSeconds = max(0, $event->end_at->getTimestamp() - $event->start_at->getTimestamp());
        $nextEnd = $nextStart->copy()->addSeconds($durationSeconds);

        $checkInOffsetSeconds = $event->check_in_opens_at
            ? $event->check_in_opens_at->getTimestamp() - $event->start_at->getTimestamp()
            : null;
        $nextCheckInOpensAt = $checkInOffsetSeconds !== null
            ? $nextStart->copy()->addSeconds($checkInOffsetSeconds)
            : null;

        $attendeeEmails = $event->attendeeEmailList();
        $attendeeEmails = $attendeeEmails === [] ? null : $attendeeEmails;

        $payload = [
            'title' => $event->title,
            'description' => $event->description,
            'location' => $event->location,
            'start_at' => $nextStart,
            'end_at' => $nextEnd,
            'check_in_opens_at' => $nextCheckInOpensAt,
            'check_in_form_fields' => $event->check_in_form_fields,
            'check_in_form_audience' => $event->check_in_form_audience,
            'is_all_day' => (bool) $event->is_all_day,
            'created_by' => $event->created_by,
            'series_id' => $event->series_id,
            'recurrence_frequency' => $event->recurrence_frequency,
            'series_index' => ((int) $event->series_index) + 1,
            'series_share_qr' => (bool) $event->series_share_qr,
            'recurrence_month_mode' => $event->recurrence_month_mode,
            'recurrence_month_day' => $event->recurrence_month_day,
            'recurrence_weekday' => $event->recurrence_weekday,
        ];

        if ($event->series_share_qr && $event->check_in_token) {
            $payload['check_in_token'] = $event->check_in_token;
        }

        $next = DB::transaction(function () use ($payload, $attendeeEmails) {
            $item = CalendarEvent::create($payload);
            SyncAssignmentRecords::syncCalendarEventAttendees($item, $attendeeEmails);

            return $item;
        });

        return $next->fresh()->load('attendees');
    }

    /**
     * @return list<CalendarEvent>
     */
    public function spawnDueOccurrences(?Carbon $now = null): array
    {
        $now ??= Carbon::now();
        $created = [];

        $seriesTips = CalendarEvent::query()
            ->whereNotNull('series_id')
            ->whereNotNull('recurrence_frequency')
            ->where('end_at', '<=', $now)
            ->get()
            ->groupBy('series_id')
            ->map(function ($events) {
                return $events->sortByDesc(fn (CalendarEvent $event) => (int) $event->series_index)->first();
            })
            ->values();

        foreach ($seriesTips as $tip) {
            $next = $this->spawnNextIfDue($tip, $now);
            if ($next) {
                $created[] = $next;
            }
        }

        return $created;
    }

    protected function alignWeeklyStart(Carbon $baseStart, int $weekday): Carbon
    {
        $candidate = $baseStart->copy();
        $current = (int) $candidate->dayOfWeek;
        $delta = ($weekday - $current + 7) % 7;

        if ($delta > 0) {
            $candidate->addDays($delta);
        }

        return $candidate;
    }

    protected function alignMonthlyStart(Carbon $baseStart, string $monthMode, ?int $monthDay): Carbon
    {
        if ($monthMode === 'same_day') {
            return $baseStart->copy();
        }

        $candidate = $this->dateInMonth($baseStart, $monthMode, $monthDay);

        if ($candidate->lt($baseStart)) {
            $candidate = $this->dateInMonth($baseStart->copy()->addMonthNoOverflow(), $monthMode, $monthDay);
        }

        return $candidate;
    }

    protected function advanceOccurrence(
        Carbon $cursor,
        string $frequency,
        ?string $monthMode = null,
        ?int $monthDay = null,
    ): Carbon {
        return match ($frequency) {
            'daily' => $cursor->copy()->addDay(),
            'weekly' => $cursor->copy()->addWeek(),
            'monthly' => $this->advanceMonthly($cursor, $monthMode ?? 'same_day', $monthDay),
            default => throw ValidationException::withMessages([
                'recurrence_frequency' => ['Invalid recurrence frequency.'],
            ]),
        };
    }

    protected function advanceMonthly(Carbon $cursor, string $monthMode, ?int $monthDay): Carbon
    {
        if ($monthMode === 'same_day') {
            return $cursor->copy()->addMonthNoOverflow();
        }

        return $this->dateInMonth($cursor->copy()->addMonthNoOverflow(), $monthMode, $monthDay);
    }

    protected function dateInMonth(Carbon $reference, string $monthMode, ?int $monthDay): Carbon
    {
        $result = $reference->copy()->startOfMonth()->setTime(
            (int) $reference->format('H'),
            (int) $reference->format('i'),
            (int) $reference->format('s'),
        );

        return match ($monthMode) {
            'first_day' => $result->day(1),
            'last_day' => $result->endOfMonth()->setTime(
                (int) $reference->format('H'),
                (int) $reference->format('i'),
                (int) $reference->format('s'),
            ),
            'day_of_month' => $result->day(min((int) $monthDay, $result->daysInMonth)),
            default => throw ValidationException::withMessages([
                'recurrence_month_mode' => ['Invalid monthly recurrence mode.'],
            ]),
        };
    }
}
