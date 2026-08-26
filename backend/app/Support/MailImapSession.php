<?php

namespace App\Support;

use Throwable;
use Webklex\PHPIMAP\Client;
use Webklex\PHPIMAP\Folder;

class MailImapSession
{
    /**
     * @param  array<string, string>  $folderMap
     */
    public function __construct(
        public Client $client,
        public Folder $folder,
        public array $folderMap,
    ) {}

    public function disconnect(): void
    {
        try {
            $this->client->disconnect();
        } catch (Throwable) {
        }
    }
}
