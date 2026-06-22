<?php

namespace App\Services;

use App\Models\AppSetting;
use App\Models\Notification;
use App\Models\User;

class WebPushWelcomeService
{
    public function sendWelcome(User $user): void
    {
        $systemName = AppSetting::query()->value('system_name')
            ?: config('app.name', 'EMZI Nexus Brain');

        $notification = Notification::create([
            'user_id' => (string) $user->id,
            'type' => 'success',
            'priority' => 'medium',
            'category' => 'system',
            'title' => 'Welcome to web push',
            'message' => "Thank you for enabling notifications! You'll receive updates from {$systemName} even when the app is closed.",
            'action_url' => '/notifications',
            'is_read' => false,
            'is_broadcast' => false,
            'delivery_channels' => ['in_app', 'web_push'],
            'data' => [
                'kind' => 'web_push_welcome',
            ],
        ]);

        app(PushNotificationService::class)->sendNotification($notification);
    }
}
