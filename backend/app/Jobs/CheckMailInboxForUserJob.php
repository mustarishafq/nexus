<?php

namespace App\Jobs;

use App\Models\User;
use App\Services\MailInboxPushService;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Middleware\RateLimited;
use Illuminate\Support\Facades\Log;
use Throwable;

class CheckMailInboxForUserJob implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 2;

    public int $timeout = 90;

    public int $uniqueFor = 100;

    public function __construct(public int $userId) {}

    public function uniqueId(): string
    {
        return 'mail-inbox-push-'.$this->userId;
    }

    /**
     * @return array<int, object>
     */
    public function middleware(): array
    {
        return [new RateLimited('mail-imap')];
    }

    public function handle(MailInboxPushService $service): void
    {
        $user = User::query()->find($this->userId);

        if (! $user || ! $service->shouldCheckUser($user)) {
            return;
        }

        $service->checkUser($user);
    }

    public function failed(?Throwable $exception): void
    {
        Log::warning('Mail inbox push job failed.', [
            'user_id' => $this->userId,
            'error' => $exception?->getMessage(),
        ]);
    }
}
