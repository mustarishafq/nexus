<?php

namespace App\Jobs;

use App\Models\AttendanceRecord;
use App\Models\User;
use App\Services\ResourceAttendanceForwarder;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

class ForwardAttendanceRecordToResourceJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 5;

    public int $timeout = 30;

    public function __construct(
        public int $attendanceRecordId,
        public ?int $userId = null,
    ) {}

    /**
     * @return list<int>
     */
    public function backoff(): array
    {
        return [10, 30, 60, 180];
    }

    public function handle(ResourceAttendanceForwarder $forwarder): void
    {
        $record = AttendanceRecord::query()->with('user')->find($this->attendanceRecordId);
        if (! $record) {
            return;
        }

        $user = $this->userId
            ? User::query()->find($this->userId)
            : $record->user;

        if (! $user) {
            return;
        }

        $result = $forwarder->forwardWithResult($record, $user);

        if (($result['retryable'] ?? false) === true) {
            throw new RuntimeException(
                sprintf(
                    'Retryable Insan attendance ingest failure for record %d: %s',
                    $record->id,
                    (string) ($result['error'] ?? 'HTTP '.($result['http_status'] ?? 'error'))
                )
            );
        }
    }

    public function failed(?Throwable $exception): void
    {
        Log::warning('Queued Resource attendance forwarder job exhausted retries', [
            'attendance_record_id' => $this->attendanceRecordId,
            'user_id' => $this->userId,
            'error' => $exception?->getMessage(),
        ]);
    }
}
