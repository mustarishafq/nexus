<?php

namespace App\Console\Commands;

use App\Services\AttendanceReminderService;
use Illuminate\Console\Command;

class SendAttendanceReminders extends Command
{
    protected $signature = 'attendance:send-reminders';

    protected $description = 'Send clock in/out reminders based on department shift schedules';

    public function handle(AttendanceReminderService $service): int
    {
        $result = $service->sendDueReminders();

        $this->info("Attendance reminders sent: {$result['sent']}, skipped: {$result['skipped']}");

        return self::SUCCESS;
    }
}
