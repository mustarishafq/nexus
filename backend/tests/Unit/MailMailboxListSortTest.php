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

    public function test_recent_sequence_starts_at_the_newest_page(): void
    {
        $service = app(MailMailboxService::class);
        $method = new ReflectionMethod(MailMailboxService::class, 'recentMessageSequenceStart');

        $this->assertSame(1, $method->invoke($service, 10, 50));
        $this->assertSame(51, $method->invoke($service, 100, 50));
        $this->assertSame(951, $method->invoke($service, 1000, 50));
    }

    public function test_raw_header_summary_reads_list_fields_without_the_body(): void
    {
        $service = app(MailMailboxService::class);
        $method = new ReflectionMethod(MailMailboxService::class, 'summarizeRawListHeader');
        $raw = implode("\r\n", [
            'From: Ada Lovelace <ada@example.com>',
            'To: Grace <grace@example.com>',
            'Subject: Hello',
            ' folded',
            'Date: Tue, 20 Oct 2026 04:00:00 +0000',
            'Content-Type: multipart/mixed; boundary=abc',
            '',
            '',
        ]);

        $summary = $method->invoke($service, 9, $raw, ['\\Seen']);

        $this->assertSame(9, $summary['uid']);
        $this->assertSame('Hello folded', $summary['subject']);
        $this->assertSame('Ada Lovelace <ada@example.com>', $summary['from']);
        $this->assertTrue($summary['seen']);
        $this->assertTrue($summary['has_attachments']);
        $this->assertNotNull($summary['date']);
    }
}
