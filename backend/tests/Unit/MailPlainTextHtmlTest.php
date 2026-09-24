<?php

namespace Tests\Unit;

use App\Services\MailMailboxService;
use App\Support\MailPlainTextHtml;
use ReflectionMethod;
use Tests\TestCase;

class MailPlainTextHtmlTest extends TestCase
{
    public function test_urls_become_clickable_links_and_trailing_punctuation_stays_outside(): void
    {
        $html = MailPlainTextHtml::toHtml("Please review https://example.com/docs.\nThanks");

        $this->assertStringContainsString(
            '<a href="https://example.com/docs" style="color:#2563eb;text-decoration:underline">https://example.com/docs</a>.',
            $html,
        );
        $this->assertStringContainsString(".<br>\nThanks", $html);
        $this->assertStringNotContainsString('href="https://example.com/docs."', $html);
    }

    public function test_query_strings_are_escaped_and_wrapped_urls_keep_the_brackets_outside(): void
    {
        $html = MailPlainTextHtml::toHtml('Open (https://example.com/pay?a=1&b=2) today');

        $this->assertStringContainsString(
            'Open (<a href="https://example.com/pay?a=1&amp;b=2" style="color:#2563eb;text-decoration:underline">https://example.com/pay?a=1&amp;b=2</a>) today',
            $html,
        );
    }

    public function test_www_and_email_addresses_are_linked(): void
    {
        $html = MailPlainTextHtml::toHtml('See www.example.com or write billing@example.com');

        $this->assertStringContainsString('href="https://www.example.com"', $html);
        $this->assertStringContainsString('href="mailto:billing@example.com"', $html);
        $this->assertStringContainsString('>billing@example.com</a>', $html);
    }

    public function test_markdown_links_use_the_label_and_html_is_escaped(): void
    {
        $html = MailPlainTextHtml::toHtml('Pay via [invoice <script>](https://example.com/invoice)');

        $this->assertStringContainsString(
            '<a href="https://example.com/invoice" style="color:#2563eb;text-decoration:underline">invoice &lt;script&gt;</a>',
            $html,
        );
        $this->assertStringNotContainsString('<script>', $html);
    }

    public function test_sent_copy_includes_an_html_alternative(): void
    {
        $service = app(MailMailboxService::class);
        $method = new ReflectionMethod(MailMailboxService::class, 'buildSentMimeMessage');
        $raw = $method->invoke($service, 'staff@example.com', 'Staff', [
            'to' => 'customer@example.com',
            'subject' => 'Your link',
            'body' => 'Open https://example.com/status',
        ]);

        $this->assertIsString($raw);
        $this->assertStringContainsString('text/html', $raw);
        $this->assertStringContainsString('text/plain', $raw);
        $this->assertStringContainsString('https://example.com/status', $raw);
    }
}
