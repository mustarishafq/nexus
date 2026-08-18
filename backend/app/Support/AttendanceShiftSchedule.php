<?php

namespace App\Support;

use Carbon\Carbon;

class AttendanceShiftSchedule
{
    /**
     * @param  array<string, mixed>  $shift
     * @return array{0: Carbon, 1: Carbon}
     */
    public static function windowForDay(array $shift, Carbon $day, string $timezone): array
    {
        $day = $day->copy()->timezone($timezone)->startOfDay();
        $start = self::timeOnDay($day, (string) ($shift['start_time'] ?? '00:00'));

        if ((bool) ($shift['crosses_midnight'] ?? false)) {
            $end = self::timeOnDay($day->copy()->addDay(), (string) ($shift['end_time'] ?? '23:59'));
        } else {
            $end = self::timeOnDay($day, (string) ($shift['end_time'] ?? '23:59'));
        }

        return [$start, $end];
    }

    /**
     * Calendar day the overnight (or regular) shift started for a timestamp inside that shift.
     *
     * Overnight example (22:00–18:00): a clock-in at 10:00 belongs to yesterday's start,
     * not today's upcoming 22:00 window.
     *
     * @param  array<string, mixed>  $shift
     */
    public static function windowDayForInstant(
        array $shift,
        Carbon $at,
        string $timezone,
        int $graceMinutes = 0,
    ): Carbon {
        $at = $at->copy()->timezone($timezone);

        if (! (bool) ($shift['crosses_midnight'] ?? false)) {
            return $at;
        }

        $startMinutes = self::timeToMinutes((string) ($shift['start_time'] ?? '00:00'));
        $currentMinutes = ($at->hour * 60) + $at->minute;
        $startBound = max(0, $startMinutes - max(0, $graceMinutes));

        // Evening start (including early grace): shift began today.
        // Morning / end portion (before startBound): shift began yesterday.
        if ($currentMinutes >= $startBound) {
            return $at;
        }

        return $at->copy()->subDay();
    }

    /**
     * @param  array<string, mixed>  $shift
     */
    public static function appliesOnDay(array $shift, Carbon $day): bool
    {
        $days = $shift['days_of_week'] ?? [];

        if ($days === []) {
            return true;
        }

        return in_array((int) $day->isoWeekday(), array_map('intval', $days), true);
    }

    /**
     * @param  array<int, array<string, mixed>>  $shifts
     * @return array<int, array<string, mixed>>
     */
    public static function shiftsForDay(array $shifts, Carbon $day): array
    {
        return array_values(array_filter(
            $shifts,
            static fn (array $shift) => self::appliesOnDay($shift, $day),
        ));
    }

    private static function timeOnDay(Carbon $day, string $time): Carbon
    {
        [$hour, $minute] = array_map('intval', explode(':', strlen($time) === 5 ? $time : substr($time, 0, 5)));

        return $day->copy()->setTime($hour, $minute, 0);
    }

    private static function timeToMinutes(string $time): int
    {
        [$hour, $minute] = array_map('intval', explode(':', strlen($time) === 5 ? $time : substr($time, 0, 5)));

        return ($hour * 60) + $minute;
    }
}
