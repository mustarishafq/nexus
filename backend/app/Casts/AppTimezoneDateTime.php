<?php

namespace App\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use InvalidArgumentException;

/**
 * Persist datetimes in the application timezone wall clock.
 *
 * The SPA sends UTC ISO strings (toISOString). Without converting to APP_TIMEZONE
 * before writing naive datetime/timestamp columns, Laravel stores the UTC clock
 * and later re-reads it as local — shifting times by the UTC offset (e.g. 8 hours).
 */
class AppTimezoneDateTime implements CastsAttributes
{
    public function get(Model $model, string $key, mixed $value, array $attributes): ?Carbon
    {
        if ($value === null) {
            return null;
        }

        return Carbon::parse($value, config('app.timezone'));
    }

    public function set(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        try {
            return Carbon::parse($value)
                ->timezone(config('app.timezone'))
                ->format('Y-m-d H:i:s');
        } catch (\Throwable $e) {
            throw new InvalidArgumentException("Invalid datetime for [{$key}]", 0, $e);
        }
    }
}
