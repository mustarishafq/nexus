<?php

namespace App\Support;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;

class NetworkHealthTimeFilter
{
    public function __construct(
        public readonly string $timezone,
        public readonly string $start,
        public readonly string $end,
    ) {}

    public static function fromValues(?string $start, ?string $end, ?string $timezone = null): ?self
    {
        if ($start === null || $start === '' || $end === null || $end === '') {
            return null;
        }

        $resolvedTimezone = ($timezone !== null && in_array($timezone, timezone_identifiers_list(), true))
            ? $timezone
            : config('app.timezone');

        return new self($resolvedTimezone, self::normalizeTime($start), self::normalizeTime($end));
    }

    private static function normalizeTime(string $time): string
    {
        return strlen($time) === 5 ? $time : Carbon::createFromFormat('H:i:s', $time)->format('H:i');
    }

    public function apply(Builder $query, Carbon $rangeStart, Carbon $rangeEnd): void
    {
        $windows = $this->buildWindows($rangeStart, $rangeEnd);

        if ($windows === []) {
            $query->whereRaw('0 = 1');

            return;
        }

        $query->where(function (Builder $outer) use ($windows) {
            foreach ($windows as [$start, $end]) {
                $outer->orWhere(function (Builder $inner) use ($start, $end) {
                    $inner->where('tested_at', '>=', $start)
                        ->where('tested_at', '<', $end);
                });
            }
        });
    }

    /**
     * @return array<int, array{0: string, 1: string}>
     */
    private function buildWindows(Carbon $rangeStart, Carbon $rangeEnd): array
    {
        $windows = [];
        $appTimezone = (string) config('app.timezone');
        $current = $rangeStart->copy()->timezone($this->timezone)->startOfDay();
        $lastDay = $rangeEnd->copy()->timezone($this->timezone)->startOfDay();

        [$startHour, $startMinute] = array_map('intval', explode(':', $this->start));
        [$endHour, $endMinute] = array_map('intval', explode(':', $this->end));

        // Datetimes are stored as APP_TIMEZONE wall clock; compare in that zone.
        $rangeStartStored = $rangeStart->copy()->timezone($appTimezone);
        $rangeEndStored = $rangeEnd->copy()->timezone($appTimezone);

        while ($current->lte($lastDay)) {
            $windowStart = $current->copy()->setTime($startHour, $startMinute, 0)->timezone($appTimezone);
            $windowEnd = $current->copy()->setTime($endHour, $endMinute, 0)->addMinute()->timezone($appTimezone);

            if ($windowEnd->gt($rangeStartStored) && $windowStart->lt($rangeEndStored)) {
                $clipStart = $windowStart->greaterThan($rangeStartStored) ? $windowStart : $rangeStartStored;
                $clipEnd = $windowEnd->lessThan($rangeEndStored) ? $windowEnd : $rangeEndStored;

                if ($clipStart->lt($clipEnd)) {
                    $windows[] = [
                        $clipStart->format('Y-m-d H:i:s'),
                        $clipEnd->format('Y-m-d H:i:s'),
                    ];
                }
            }

            $current->addDay();
        }

        return $windows;
    }
}
