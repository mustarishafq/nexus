<?php

namespace Tests\Unit;

use App\Support\MailCalendarInvite;
use App\Support\MailCalendarReplyPart;
use Symfony\Component\Mime\Email;
use Tests\TestCase;

class MailCalendarInviteTest extends TestCase
{
    public function test_it_parses_a_timezone_meeting_request(): void
    {
        $invite = MailCalendarInvite::parse($this->sampleRequest());

        $this->assertNotNull($invite);
        $this->assertSame('REQUEST', $invite['method']);
        $this->assertSame('Update of E-commerce fulfillment services', $invite['summary']);
        $this->assertSame('EMZI - Explore Potential Collaboration', $invite['description']);
        $this->assertSame('Asia/Dubai', $invite['timezone']);
        $this->assertSame('Wednesday, 21 October 2026, 11:00 – 12:00 (Asia/Dubai)', $invite['when_label']);
        $this->assertSame('Imran Shahani', $invite['organizer_name']);
        $this->assertSame('Imran.Shahani@dhl.com', $invite['organizer_email']);
        $this->assertTrue($invite['can_reply']);
        $this->assertSame('anuar.ali@emzi.com.my', $invite['attendees'][0]['email']);
    }

    public function test_it_unfolds_long_lines_and_skips_replies(): void
    {
        $ics = "BEGIN:VCALENDAR\r\nMETHOD:REPLY\r\nBEGIN:VEVENT\r\nSUMMARY:Quarterly review of the\r\n  fulfillment desk\r\nUID:abc\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";

        $invite = MailCalendarInvite::parse($ics);

        $this->assertSame('Quarterly review of the fulfillment desk', $invite['summary']);
        $this->assertFalse($invite['can_reply']);
    }

    public function test_it_builds_a_reply_that_keeps_the_original_event(): void
    {
        $reply = MailCalendarInvite::buildReply(
            $this->sampleRequest(),
            'anuar.ali@emzi.com.my',
            'Anuar Ali',
            'ACCEPTED',
        );

        $this->assertStringContainsString('METHOD:REPLY', $reply);
        $this->assertStringContainsString('UID:meeting-1@dhl.com', $reply);
        $this->assertStringContainsString('DTSTART;TZID=Asia/Dubai:20261021T110000', $reply);
        $this->assertStringContainsString('ATTENDEE;PARTSTAT=ACCEPTED;CN=Anuar Ali:mailto:anuar.ali@emzi.com.my', $reply);
        $this->assertStringContainsString('ORGANIZER;CN=Imran Shahani:mailto:Imran.Shahani@dhl.com', $reply);
    }

    public function test_reply_part_can_be_attached_to_an_email(): void
    {
        $reply = MailCalendarInvite::buildReply(
            $this->sampleRequest(),
            'anuar.ali@emzi.com.my',
            'Anuar Ali',
            'ACCEPTED',
        );

        $raw = (new Email)
            ->from('anuar.ali@emzi.com.my')
            ->to('Imran.Shahani@dhl.com')
            ->subject('Accepted: Update of E-commerce fulfillment services')
            ->text('Accepted')
            ->addPart(new MailCalendarReplyPart($reply))
            ->toString();

        $this->assertStringContainsString('text/calendar', $raw);
        $this->assertStringContainsString('method=REPLY', $raw);
        $this->assertStringContainsString('Content-Disposition: inline', $raw);
    }

    private function sampleRequest(): string
    {
        return implode("\r\n", [
            'BEGIN:VCALENDAR',
            'METHOD:REQUEST',
            'VERSION:2.0',
            'BEGIN:VEVENT',
            'UID:meeting-1@dhl.com',
            'DTSTART;TZID=Asia/Dubai:20261021T110000',
            'DTEND;TZID=Asia/Dubai:20261021T120000',
            'SUMMARY:Update of E-commerce fulfillment services',
            'DESCRIPTION:EMZI - Explore Potential Collaboration',
            'ORGANIZER;CN=Imran Shahani:mailto:Imran.Shahani@dhl.com',
            'ATTENDEE;CN=Anuar Ali;RSVP=TRUE:mailto:anuar.ali@emzi.com.my',
            'END:VEVENT',
            'END:VCALENDAR',
            '',
        ]);
    }
}
