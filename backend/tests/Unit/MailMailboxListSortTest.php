<?php

namespace Tests\Unit;

use App\Services\MailMailboxService;
use ReflectionMethod;
use Tests\TestCase;

class MailMailboxListSortTest extends TestCase
{
    public function test_sort_messages_newest_first_by_date_then_uid(): void
    {
        $service = app(MailMailboxService::class);
        $method = new ReflectionMethod(MailMailboxService::class, 'sortMessagesNewestFirst');

        $sorted = $method->invoke($service, [
            ['uid' => 1, 'date' => 'Mon, 01 Jan 2024 10:00:00 +0000', 'subject' => 'oldest'],
            ['uid' => 3, 'date' => 'Wed, 03 Jan 2024 10:00:00 +0000', 'subject' => 'newest'],
            ['uid' => 2, 'date' => 'Tue, 02 Jan 2024 10:00:00 +0000', 'subject' => 'middle'],
            ['uid' => 5, 'date' => 'Wed, 03 Jan 2024 10:00:00 +0000', 'subject' => 'newest-later-uid'],
        ]);

        $this->assertSame([5, 3, 2, 1], array_column($sorted, 'uid'));
    }
}
