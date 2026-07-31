<?php

namespace App\Console\Commands;

use App\Services\CalendarEventRecurrenceService;
use Illuminate\Console\Command;

class SpawnNextRecurringCalendarEvents extends Command
{
    protected $signature = 'calendar:spawn-next-recurring';

    protected $description = 'Create the next occurrence for recurring calendar events that have ended';

    public function handle(CalendarEventRecurrenceService $recurrenceService): int
    {
        $created = $recurrenceService->spawnDueOccurrences();

        $this->info('Spawned '.count($created).' next recurring event(s).');

        return self::SUCCESS;
    }
}
