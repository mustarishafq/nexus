<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\User;

class AdminNotificationService
{
    /**
     * @param  array<int, int|string>  $userIds
     * @return array{sent: int, skipped: int, errors: list<string>, notifications: list<int>}
     */
    public function sendToUsers(
        User $admin,
        array $userIds,
        string $title,
        ?string $message,
        bool $sendInApp,
        bool $sendWebPush,
        string $type = 'info',
        string $priority = 'medium',
        ?string $actionUrl = null,
    ): array {
        $uniqueIds = collect($userIds)
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values();

        if ($uniqueIds->isEmpty()) {
            return [
                'sent' => 0,
                'skipped' => 0,
                'errors' => ['No valid users were selected.'],
                'notifications' => [],
            ];
        }

        $users = User::query()
            ->whereIn('id', $uniqueIds)
            ->get()
            ->keyBy('id');

        $sent = 0;
        $skipped = 0;
        $errors = [];
        $notificationIds = [];
        $adminName = $admin->displayName();

        foreach ($uniqueIds as $userId) {
            $user = $users->get($userId);

            if (! $user) {
                $errors[] = "User #{$userId} was not found.";
                $skipped++;
                continue;
            }

            if (! $user->is_approved) {
                $errors[] = "{$user->email}: User is not approved yet.";
                $skipped++;
                continue;
            }

            try {
                $notificationId = $this->sendToUser(
                    $user,
                    $admin,
                    $adminName,
                    $title,
                    $message,
                    $sendInApp,
                    $sendWebPush,
                    $type,
                    $priority,
                    $actionUrl,
                );

                if ($notificationId !== null) {
                    $notificationIds[] = $notificationId;
                }

                $sent++;
            } catch (\Throwable $exception) {
                $errors[] = "{$user->email}: {$exception->getMessage()}";
                $skipped++;
            }
        }

        return [
            'sent' => $sent,
            'skipped' => $skipped,
            'errors' => $errors,
            'notifications' => $notificationIds,
        ];
    }

    private function sendToUser(
        User $user,
        User $admin,
        string $adminName,
        string $title,
        ?string $message,
        bool $sendInApp,
        bool $sendWebPush,
        string $type,
        string $priority,
        ?string $actionUrl,
    ): ?int {
        $deliveryChannels = array_values(array_filter([
            $sendInApp ? 'in_app' : null,
            $sendWebPush ? 'web_push' : null,
        ]));

        $data = [
            'kind' => 'admin_manual',
            'sent_by_user_id' => $admin->id,
            'sent_by_name' => $adminName,
        ];

        if ($sendInApp) {
            $notification = Notification::create([
                'user_id' => (string) $user->id,
                'type' => $type,
                'priority' => $priority,
                'category' => 'announcement',
                'title' => $title,
                'message' => $message,
                'action_url' => $actionUrl,
                'is_read' => false,
                'is_broadcast' => false,
                'delivery_channels' => $deliveryChannels,
                'data' => $data,
            ]);

            if ($sendWebPush) {
                app(PushNotificationService::class)->sendNotification($notification);
            }

            return $notification->id;
        }

        if ($sendWebPush) {
            app(PushNotificationService::class)->sendToUser((string) $user->id, [
                'title' => $title,
                'message' => $message,
                'type' => $type,
                'priority' => $priority,
                'category' => 'announcement',
                'action_url' => $actionUrl,
                'is_broadcast' => false,
                'data' => $data,
            ]);
        }

        return null;
    }
}
