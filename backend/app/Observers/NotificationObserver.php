<?php

namespace App\Observers;

use App\Models\Notification;
use App\Services\UserTodoService;

class NotificationObserver
{
    public function __construct(
        protected UserTodoService $userTodoService
    ) {}

    public function created(Notification $notification): void
    {
        $this->userTodoService->createFromNotification($notification);
    }

    public function updated(Notification $notification): void
    {
        if (! $notification->wasChanged('is_read')) {
            return;
        }

        if ($notification->is_read) {
            $this->userTodoService->completeForNotification($notification);

            return;
        }

        $this->userTodoService->reopenForNotification($notification);
    }

    public function deleted(Notification $notification): void
    {
        $this->userTodoService->completeForNotification($notification);
    }
}
