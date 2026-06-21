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
}
