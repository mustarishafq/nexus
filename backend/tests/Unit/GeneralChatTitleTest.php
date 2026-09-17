<?php

namespace Tests\Unit;

use App\Support\GeneralChatTitle;
use Tests\TestCase;

class GeneralChatTitleTest extends TestCase
{
    public function test_turns_a_request_into_title_case_topic(): void
    {
        $this->assertSame(
            'I Prefer Concise Answers',
            GeneralChatTitle::fromMessage('Please remember I prefer concise answers'),
        );
    }

    public function test_uses_attachment_name_when_message_is_empty(): void
    {
        $this->assertSame(
            'Budget Notes',
            GeneralChatTitle::fromMessage('', [[
                'url' => '/storage/general-chat/budget-notes.txt',
                'name' => 'budget-notes.txt',
                'mime' => 'text/plain',
            ]]),
        );
    }

    public function test_rejects_generic_model_titles(): void
    {
        $this->assertSame(
            'Polite Email Draft',
            GeneralChatTitle::fromModel('Hello from chat.', 'Polite Email Draft', 'Hello from chat.'),
        );
    }
}
