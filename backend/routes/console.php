<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('attendance:send-reminders')->everyFiveMinutes();
Schedule::command('applications:check-health')->everyFiveMinutes();
Schedule::command('mail:check-inbox-push')
    ->everyTwoMinutes()
    ->withoutOverlapping(3)
    ->when(fn () => (bool) config('mail.imap.enabled'));
Schedule::command('conversations:prune-empty')->hourly();
Schedule::command('calendar:spawn-next-recurring')->everyFiveMinutes()->withoutOverlapping(5);
// Backstop only — the live quiz's real transitions are driven by
// AdvanceQuizSessionJob (queue, delayed to the exact deadline). This just
// catches a session whose job was somehow lost.
Schedule::command('quiz:sweep-stale-sessions')->everyMinute()->withoutOverlapping(1);
