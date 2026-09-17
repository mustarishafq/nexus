<?php

namespace Tests\Unit;

use App\Services\Mail\MailAiDraftService;
use Tests\TestCase;

class MailAiDraftServiceTest extends TestCase
{
    public function test_parses_raw_json(): void
    {
        $parsed = MailAiDraftService::parseDraftJson(
            '{"subject":"Q3 numbers","body":"Please send the report.","to":"ada@example.com"}'
        );

        $this->assertSame('Q3 numbers', $parsed['subject']);
        $this->assertSame('Please send the report.', $parsed['body']);
        $this->assertSame('ada@example.com', $parsed['to']);
    }

    public function test_parses_fenced_json(): void
    {
        $parsed = MailAiDraftService::parseDraftJson(<<<TXT
Here you go
```json
{"subject":"Hello","body":"Hi team","to":""}
```
TXT);

        $this->assertSame('Hello', $parsed['subject']);
        $this->assertSame('Hi team', $parsed['body']);
        $this->assertSame('', $parsed['to']);
    }

    public function test_parses_json_embedded_in_prose(): void
    {
        $parsed = MailAiDraftService::parseDraftJson(
            'Draft: {"subject":"Follow up","body":"Just checking in.","to":""} thanks'
        );

        $this->assertSame('Follow up', $parsed['subject']);
        $this->assertSame('Just checking in.', $parsed['body']);
    }

    public function test_returns_empty_fields_for_garbage(): void
    {
        $parsed = MailAiDraftService::parseDraftJson('not json at all');

        $this->assertSame('', $parsed['subject']);
        $this->assertSame('', $parsed['body']);
        $this->assertSame('', $parsed['to']);
    }

    public function test_language_instruction_defaults_to_matching_the_user_text(): void
    {
        $this->assertStringContainsString(
            'same language as the Instruction',
            MailAiDraftService::languageInstruction('auto'),
        );
        $this->assertStringContainsString(
            'Bahasa Melayu',
            MailAiDraftService::languageInstruction('ms'),
        );
        $this->assertStringContainsString(
            'English',
            MailAiDraftService::languageInstruction('en'),
        );
    }
}
