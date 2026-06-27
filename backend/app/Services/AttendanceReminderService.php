<?php

namespace App\Services;

use App\Models\AttendanceRecord;
use App\Models\DepartmentAttendanceSetting;
use App\Models\Notification;
use App\Models\User;
use App\Support\AttendanceReminderEvaluator;
use App\Support\AppSettings;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class AttendanceReminderService
{
    public const COOLDOWN_HOURS = 4;

    /**
     * @return array{sent: int, skipped: int}
     */
    public function sendDueReminders(): array
    {
        if (! $this->isAttendanceEnabled()) {
            return ['sent' => 0, 'skipped' => 0];
        }

        $settingsByDepartment = DepartmentAttendanceSetting::query()
            ->where('enabled', true)
            ->get()
            ->keyBy('department_id');

        if ($settingsByDepartment->isEmpty()) {
            return ['sent' => 0, 'skipped' => 0];
        }

        $users = User::query()
            ->with('department')
            ->where('is_approved', true)
            ->whereNotNull('department_id')
            ->whereIn('department_id', $settingsByDepartment->keys())
            ->get();

        if ($users->isEmpty()) {
            return ['sent' => 0, 'skipped' => 0];
        }

        $userIds = $users->pluck('id');
        $todayStart = now()->startOfDay();
        $todayEnd = now()->endOfDay();

        $todayRecordsByUser = AttendanceRecord::query()
            ->whereIn('user_id', $userIds)
            ->whereBetween('captured_at', [$todayStart, $todayEnd])
            ->orderBy('captured_at')
            ->get()
            ->groupBy('user_id');

        $lastRecordIds = AttendanceRecord::query()
            ->selectRaw('MAX(id) as id')
            ->whereIn('user_id', $userIds)
            ->groupBy('user_id')
            ->pluck('id');

        $lastRecordsByUser = AttendanceRecord::query()
            ->whereIn('id', $lastRecordIds)
            ->get()
            ->keyBy('user_id');

        $cooldownKeys = $this->loadCooldownKeys($userIds);

        $sent = 0;
        $skipped = 0;

        foreach ($users as $user) {
            $setting = $settingsByDepartment->get($user->department_id);

            if (! $setting) {
                $skipped++;
                continue;
            }

            $result = $this->sendReminderIfDue(
                $user,
                false,
                $setting,
                $todayRecordsByUser->get($user->id, collect()),
                $lastRecordsByUser->get($user->id),
                $cooldownKeys,
            );

            if ($result['sent']) {
                $sent++;
            } else {
                $skipped++;
            }
        }

        return ['sent' => $sent, 'skipped' => $skipped];
    }

    /**
     * @param  Collection<int, AttendanceRecord>  $todayRecords
     * @param  Collection<int, string>  $cooldownKeys
     * @return array{sent: bool, reason?: string, reminder?: array<string, mixed>}
     */
    public function sendReminderIfDue(
        User $user,
        bool $force = false,
        ?DepartmentAttendanceSetting $setting = null,
        ?Collection $todayRecords = null,
        ?AttendanceRecord $lastRecord = null,
        ?Collection $cooldownKeys = null,
    ): array {
        $reminder = $this->evaluateForUser($user, $setting, $todayRecords, $lastRecord);

        if (! $reminder) {
            return ['sent' => false, 'reason' => 'No reminder due.'];
        }

        if (! $force && $this->isOnCooldown($user, (string) $reminder['type'], $cooldownKeys)) {
            return ['sent' => false, 'reason' => 'Reminder already sent recently.'];
        }

        $notification = Notification::create([
            'user_id' => (string) $user->id,
            'type' => $reminder['urgency'] === 'high' ? 'warning' : 'info',
            'priority' => $reminder['urgency'] === 'high' ? 'high' : 'medium',
            'category' => 'hr',
            'title' => $reminder['title'],
            'message' => $reminder['message'],
            'action_url' => $reminder['action_url'] ?? '/attendance',
            'is_read' => false,
            'is_broadcast' => false,
            'delivery_channels' => ['in_app'],
            'data' => [
                'kind' => 'attendance_reminder',
                'reminder_type' => $reminder['type'],
                'shift_name' => $reminder['shift_name'] ?? null,
                'minutes_late' => $reminder['minutes_late'] ?? null,
            ],
        ]);

        app(PushNotificationService::class)->sendNotification($notification);

        return [
            'sent' => true,
            'reminder' => $reminder,
        ];
    }

    /**
     * @param  Collection<int, AttendanceRecord>|null  $todayRecords
     * @return array<string, mixed>|null
     */
    public function evaluateForUser(
        User $user,
        ?DepartmentAttendanceSetting $setting = null,
        ?Collection $todayRecords = null,
        ?AttendanceRecord $lastRecord = null,
    ): ?array {
        if (! $this->isAttendanceEnabled()) {
            return null;
        }

        if ($todayRecords === null) {
            $todayStart = now()->startOfDay();
            $todayEnd = now()->endOfDay();

            $todayRecords = AttendanceRecord::query()
                ->where('user_id', $user->id)
                ->whereBetween('captured_at', [$todayStart, $todayEnd])
                ->orderBy('captured_at')
                ->get();
        }

        if ($lastRecord === null) {
            $lastRecord = AttendanceRecord::query()
                ->where('user_id', $user->id)
                ->orderByDesc('captured_at')
                ->first();
        }

        return AttendanceReminderEvaluator::evaluate($user, $lastRecord, $todayRecords, null, $setting);
    }

    /**
     * @param  Collection<int, int|string>  $userIds
     * @return Collection<int, string>
     */
    private function loadCooldownKeys(Collection $userIds): Collection
    {
        return Notification::query()
            ->whereIn('user_id', $userIds->map(fn ($id) => (string) $id))
            ->where('data->kind', 'attendance_reminder')
            ->where('created_at', '>=', Carbon::now()->subHours(self::COOLDOWN_HOURS))
            ->get(['user_id', 'data'])
            ->map(fn (Notification $notification) => $this->cooldownKey(
                (string) $notification->user_id,
                (string) ($notification->data['reminder_type'] ?? ''),
            ));
    }

    /**
     * @param  Collection<int, string>|null  $cooldownKeys
     */
    private function isOnCooldown(User $user, string $reminderType, ?Collection $cooldownKeys = null): bool
    {
        $key = $this->cooldownKey((string) $user->id, $reminderType);

        if ($cooldownKeys !== null) {
            return $cooldownKeys->contains($key);
        }

        return Notification::query()
            ->where('user_id', (string) $user->id)
            ->where('data->kind', 'attendance_reminder')
            ->where('data->reminder_type', $reminderType)
            ->where('created_at', '>=', Carbon::now()->subHours(self::COOLDOWN_HOURS))
            ->exists();
    }

    private function cooldownKey(string $userId, string $reminderType): string
    {
        return "{$userId}:{$reminderType}";
    }

    private function isAttendanceEnabled(): bool
    {
        return AppSettings::isAttendanceEnabled();
    }
}
