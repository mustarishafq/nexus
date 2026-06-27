<?php

namespace App\Console\Commands;

use App\Models\Conversation;
use Illuminate\Console\Command;

class PruneEmptyConversations extends Command
{
    protected $signature = 'conversations:prune-empty';

    protected $description = 'Delete conversations that have no messages';

    public function handle(): int
    {
        $deleted = Conversation::query()
            ->whereDoesntHave('messages')
            ->delete();

        $this->info("Pruned {$deleted} empty conversation(s).");

        return self::SUCCESS;
    }
}
