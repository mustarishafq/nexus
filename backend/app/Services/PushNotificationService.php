<?php

namespace App\Services;

use App\Models\Notification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Throwable;
use Minishlink\WebPush\MessageSentReport;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;

class PushNotificationService
{
    public function isEnabled(): bool
    {
        return filled(config('services.web_push.public_key'))
            && filled(config('services.web_push.private_key'))
            && filled(config('services.web_push.subject'));
    }

    public function publicKey(): ?string
    {
        return config('services.web_push.public_key');
    }

    public function sendNotification(Notification $notification): void
    {
        $subscriptions = collect();

        try {
            if (! $this->isEnabled()) {
                return;
            }

            $subscriptions = $this->subscriptionsForNotification($notification);

            if ($subscriptions->isEmpty()) {
                return;
            }

            $payload = json_encode([
                'id' => $notification->id,
                'title' => $notification->title,
                'message' => $notification->message,
                'type' => $notification->type,
                'priority' => $notification->priority,
                'category' => $notification->category,
                'action_url' => $notification->action_url,
                'system_id' => $notification->system_id,
                'is_broadcast' => (bool) $notification->is_broadcast,
                'created_at' => $notification->created_at?->toISOString(),
            ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

            if ($payload === false) {
                return;
            }

            $webPush = new WebPush([
                'VAPID' => [
                    'subject' => config('services.web_push.subject'),
                    'publicKey' => config('services.web_push.public_key'),
                    'privateKey' => config('services.web_push.private_key'),
                ],
            ]);

            foreach ($subscriptions as $subscription) {
                $webPush->queueNotification(
                    Subscription::create([
                        'endpoint' => $subscription->endpoint,
                        'keys' => [
                            'p256dh' => $subscription->public_key,
                            'auth' => $subscription->auth_token,
                        ],
                        'contentEncoding' => $subscription->content_encoding,
                    ]),
                    $payload,
                    [
                        'TTL' => 2419200,
                        'contentType' => 'application/json',
                        'topic' => (string) $notification->id,
                    ]
                );
            }

            $webPush->flushPooled(function (MessageSentReport $report): void {
                if ($this->shouldDeleteSubscription($report)) {
                    DB::table('push_subscriptions')->where('endpoint', $report->getEndpoint())->delete();
                    return;
                }

                if (! $report->isSuccess()) {
                    Log::warning('Push notification delivery failed.', [
                        'endpoint' => $report->getEndpoint(),
                        'reason' => $report->getReason(),
                    ]);
                }
            });
        } catch (Throwable $exception) {
            Log::warning('Push notification pipeline failed.', [
                'notification_id' => $notification->id,
                'error' => $exception->getMessage(),
            ]);

            $this->sendFallbackWithoutPayload($notification, $subscriptions, $exception);
        }
    }

    private function sendFallbackWithoutPayload(Notification $notification, Collection $subscriptions, Throwable $exception): void
    {
        if ($subscriptions->isEmpty()) {
            return;
        }

        $message = strtolower($exception->getMessage());
        $isEncryptionBootstrapError = str_contains($message, 'openssl_pkey_new')
            || str_contains($message, 'unable to create the local key');

        if (! $isEncryptionBootstrapError) {
            return;
        }

        try {
            $webPush = new WebPush([
                'VAPID' => [
                    'subject' => config('services.web_push.subject'),
                    'publicKey' => config('services.web_push.public_key'),
                    'privateKey' => config('services.web_push.private_key'),
                ],
            ]);

            foreach ($subscriptions as $subscription) {
                $webPush->queueNotification(
                    Subscription::create([
                        'endpoint' => $subscription->endpoint,
                        'keys' => [
                            'p256dh' => $subscription->public_key,
                            'auth' => $subscription->auth_token,
                        ],
                        'contentEncoding' => $subscription->content_encoding,
                    ]),
                    null,
                    [
                        'TTL' => 2419200,
                        'topic' => (string) $notification->id,
                    ]
                );
            }

            $webPush->flushPooled(function (MessageSentReport $report): void {
                if ($this->shouldDeleteSubscription($report)) {
                    DB::table('push_subscriptions')->where('endpoint', $report->getEndpoint())->delete();
                    return;
                }

                if (! $report->isSuccess()) {
                    Log::warning('Push notification delivery failed (fallback).', [
                        'endpoint' => $report->getEndpoint(),
                        'reason' => $report->getReason(),
                    ]);
                }
            });

            Log::info('Push notification fallback (no payload) sent.', [
                'notification_id' => $notification->id,
            ]);
        } catch (Throwable $fallbackException) {
            Log::warning('Push fallback pipeline failed.', [
                'notification_id' => $notification->id,
                'error' => $fallbackException->getMessage(),
            ]);
        }
    }

    private function subscriptionsForNotification(Notification $notification): Collection
    {
        if ($notification->is_broadcast || empty($notification->user_id)) {
            return DB::table('push_subscriptions')->orderByDesc('created_at')->get();
        }

        return DB::table('push_subscriptions')
            ->where('user_id', $notification->user_id)
            ->orderByDesc('created_at')
            ->get();
    }

    private function shouldDeleteSubscription(MessageSentReport $report): bool
    {
        if ($report->isSubscriptionExpired()) {
            return true;
        }

        if ($report->isSuccess()) {
            return false;
        }

        $reason = (string) $report->getReason();

        return str_contains($reason, '401') || str_contains($reason, '403');
    }
}