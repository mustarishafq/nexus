<?php

namespace Tests\Unit;

use App\Services\MailMailboxService;
use ReflectionMethod;
use Tests\TestCase;

class MailMailboxUtf8Test extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // PHP 8.4+ unbundled ext-imap; CI/php-cli images often omit it. decodePart
        // only needs these constants, not a live IMAP connection.
        foreach ([
            'TYPETEXT' => 0,
            'TYPEMESSAGE' => 2,
            'ENC7BIT' => 0,
            'ENCBASE64' => 3,
            'ENCQUOTEDPRINTABLE' => 4,
        ] as $name => $value) {
            if (! defined($name)) {
                define($name, $value);
            }
        }
    }

    public function test_ensure_utf8_converts_iso_8859_1_to_valid_utf8(): void
    {
        $service = app(MailMailboxService::class);
        $method = new ReflectionMethod(MailMailboxService::class, 'ensureUtf8');

        // "café" in ISO-8859-1
        $latin1 = "caf\xE9";
        $converted = $method->invoke($service, $latin1, 'ISO-8859-1');

        $this->assertSame('café', $converted);
        $this->assertTrue(mb_check_encoding($converted, 'UTF-8'));
        $this->assertNotFalse(json_encode(['body' => $converted]));
    }

    public function test_ensure_utf8_scrubs_invalid_utf8_bytes(): void
    {
        $service = app(MailMailboxService::class);
        $method = new ReflectionMethod(MailMailboxService::class, 'ensureUtf8');

        $invalid = "hello\xC3\x28world";
        $converted = $method->invoke($service, $invalid);

        $this->assertTrue(mb_check_encoding($converted, 'UTF-8'));
        $this->assertNotFalse(json_encode(['body' => $converted]));
        $this->assertStringContainsString('hello', $converted);
        $this->assertStringContainsString('world', $converted);
    }

    public function test_decode_part_converts_text_charset_before_json(): void
    {
        $service = app(MailMailboxService::class);
        $method = new ReflectionMethod(MailMailboxService::class, 'decodePart');

        $part = (object) [
            'type' => TYPETEXT,
            'encoding' => ENC7BIT,
            'parameters' => [
                (object) ['attribute' => 'charset', 'value' => 'windows-1252'],
            ],
        ];

        // Em dash in Windows-1252
        $raw = "Price \x96 100";
        $decoded = $method->invoke($service, $raw, $part);

        $this->assertTrue(mb_check_encoding($decoded, 'UTF-8'));
        $this->assertNotFalse(json_encode(['body' => $decoded]));
        $this->assertStringContainsString('Price', $decoded);
        $this->assertStringContainsString('100', $decoded);
    }

    public function test_content_headers_detect_attachments_without_body(): void
    {
        $service = app(MailMailboxService::class);
        $method = new ReflectionMethod(MailMailboxService::class, 'contentHeadersSuggestAttachments');

        $this->assertTrue($method->invoke($service, 'multipart/mixed; boundary="abc"', '', '', ''));
        $this->assertTrue($method->invoke($service, 'text/plain', 'attachment; filename="a.pdf"', '', ''));
        $this->assertTrue($method->invoke($service, 'text/html', '', '', 'yes'));
        $this->assertTrue($method->invoke(
            $service,
            'multipart/alternative',
            '',
            "Content-Type: multipart/alternative\r\nContent-Disposition: attachment; filename=\"x.csv\"\r\n",
            '',
        ));
        $this->assertFalse($method->invoke($service, 'multipart/alternative; boundary="x"', '', '', ''));
        $this->assertFalse($method->invoke($service, 'text/plain; charset=utf-8', '', '', ''));
    }
}
