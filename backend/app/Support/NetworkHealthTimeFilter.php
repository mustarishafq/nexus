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
        $current = $rangeStart->copy()->timezone($this->timezone)->startOfDay();
        $lastDay = $rangeEnd->copy()->timezone($this->timezone)->startOfDay();

        [$startHour, $startMinute] = array_map('intval', explode(':', $this->start));
        [$endHour, $endMinute] = array_map('intval', explode(':', $this->end));

        $rangeStartUtc = $rangeStart->copy()->utc();
        $rangeEndUtc = $rangeEnd->copy()->utc();

        while ($current->lte($lastDay)) {
            $windowStart = $current->copy()->setTime($startHour, $startMinute, 0)->utc();
            $windowEnd = $current->copy()->setTime($endHour, $endMinute, 0)->addMinute()->utc();

            if ($windowEnd->gt($rangeStartUtc) && $windowStart->lt($rangeEndUtc)) {
                $clipStart = $windowStart->greaterThan($rangeStartUtc) ? $windowStart : $rangeStartUtc;
                $clipEnd = $windowEnd->lessThan($rangeEndUtc) ? $windowEnd : $rangeEndUtc;

                if ($clipStart->lt($clipEnd)) {
                    $windows[] = [
                        $clipStart->toDateTimeString(),
                        $clipEnd->toDateTimeString(),
                    ];
                }
            }

            $current->addDay();
        }

        return $windows;
    }
}
