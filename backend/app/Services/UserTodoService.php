<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\User;
use App\Models\UserTodo;
use Illuminate\Support\Carbon;

class UserTodoService
{
    public function createFromNotification(Notification $notification): ?UserTodo
    {
        if ($notification->is_broadcast || ! filled($notification->user_id)) {
            return null;
        }

        if (data_get($notification->data, 'kind') === 'direct_message') {
            return null;
        }

        $userId = $this->resolveUserId($notification);
        if (! $userId) {
            return null;
        }

        $calendarEventId = data_get($notification->data, 'calendar_event_id');

        return UserTodo::query()->firstOrCreate(
            [
                'user_id' => $userId,
                'notification_id' => $notification->id,
            ],
            [
                'calendar_event_id' => filled($calendarEventId) ? (int) $calendarEventId : null,
                'source_type' => UserTodo::SOURCE_NOTIFICATION,
                'title' => (string) $notification->title,
                'message' => $notification->message,
                'action_url' => $notification->action_url,
                'system_id' => $notification->system_id,
                'category' => $notification->category,
                'type' => $notification->type ?? 'info',
                'completed_at' => $notification->is_read ? now() : null,
            ]
        );
    }

    public function completeForNotification(Notification $notification): void
    {
        UserTodo::query()
            ->where('notification_id', $notification->id)
            ->whereNull('completed_at')
            ->update(['completed_at' => now()]);
    }

    public function reopenForNotification(Notification $notification): void
    {
        UserTodo::query()
            ->where('notification_id', $notification->id)
            ->whereNotNull('completed_at')
            ->update(['completed_at' => null]);
    }

    public function complete(UserTodo $todo, ?Carbon $completedAt = null): UserTodo
    {
        $completedAt ??= now();

        $todo->update(['completed_at' => $completedAt]);

        if ($todo->notification_id) {
            $notification = $todo->notification;
            if ($notification && ! $notification->is_read) {
                $notification->update([
                    'is_read' => true,
                    'read_at' => $completedAt,
                ]);
            }
        }

        return $todo->fresh();
    }

    protected function resolveUserId(Notification $notification): ?int
    {
        $identifier = trim((string) $notification->user_id);
        if ($identifier === '') {
            return null;
        }

        $userId = User::query()
            ->where('is_approved', true)
            ->where(function ($query) use ($identifier) {
                $query->where('id', $identifier)
                    ->orWhere('email', $identifier);
            })
            ->value('id');

        return $userId ? (int) $userId : null;
    }
}
