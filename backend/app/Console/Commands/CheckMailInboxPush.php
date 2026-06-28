<?php

namespace App\Console\Commands;

use App\Services\MailInboxPushService;
use Illuminate\Console\Command;

class CheckMailInboxPush extends Command
{
    protected $signature = 'mail:check-inbox-push {--sync : Run synchronously instead of queueing jobs}';

    protected $description = 'Check connected mailboxes and send web push alerts for new unread messages';

    public function handle(MailInboxPushService $service): int
    {
        if ($this->option('sync')) {
            $summary = $service->checkAll();

            $this->info(sprintf(
                'Mail inbox push (sync): checked %d, notified %d, skipped %d, errors %d',
                $summary['checked'],
                $summary['notified'],
                $summary['skipped'],
                $summary['errors'],
            ));

            return self::SUCCESS;
        }

        $summary = $service->dispatchChecks();

        $this->info(sprintf(
            'Mail inbox push: dispatched %d jobs, skipped %d',
            $summary['dispatched'],
            $summary['skipped'],
        ));

        return self::SUCCESS;
    }
}
