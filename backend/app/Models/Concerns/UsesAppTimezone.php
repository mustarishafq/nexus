<?php

namespace App\Models\Concerns;

use DateTimeInterface;
use Illuminate\Support\Carbon;

trait UsesAppTimezone
{
    /**
     * Persist datetime attributes as APP_TIMEZONE wall-clock values.
     *
     * The SPA sends UTC ISO strings (toISOString). Without converting to the
     * app timezone first, Eloquent stores the UTC clock and later re-reads it
     * as local — shifting times by the UTC offset.
     */
    public function fromDateTime($value)
    {
        if (empty($value)) {
            return $value;
        }

        return $this->asDateTime($value)
            ->timezone(config('app.timezone'))
            ->format($this->getDateFormat());
    }

    protected function serializeDate(DateTimeInterface $date): string
    {
        return Carbon::instance($date)
            ->timezone(config('app.timezone'))
            ->format('Y-m-d\TH:i:s.uP');
    }
}
