<?php

namespace Tests\Feature;

use App\Models\LlmUsageLog;
use App\Models\User;
use App\Services\Mail\MailAiDraftService;
use App\Support\ApiTokenAuth;
use App\Support\AppSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class MailAiDraftTest extends TestCase
{
    use RefreshDatabase;

    private function token(User $user): string
    {
        return ApiTokenAuth::issueToken($user);
    }

    private function configureOpenRouter(): void
    {
        $payload = [
            'system_name' => 'EMZI Nexus Brain',
            'openrouter_api_key' => 'test-key',
            'openrouter_model' => 'openai/gpt-4o-mini',
            'created_at' => now(),
            'updated_at' => now(),
        ];

        $existing = DB::table('app_settings')->first();
        if ($existing) {
            DB::table('app_settings')->where('id', $existing->id)->update($payload);
        } else {
            DB::table('app_settings')->insert($payload);
        }

        AppSettings::forget();
    }

    private function fakeOpenRouter(string $content): void
    {
        Http::fake([
            'https://openrouter.ai/api/v1/chat/completions' => Http::response([
                'id' => 'gen-mail-draft',
                'model' => 'openai/gpt-4o-mini',
                'choices' => [[
                    'message' => [
                        'role' => 'assistant',
                        'content' => $content,
                    ],
                ]],
                'usage' => [
                    'prompt_tokens' => 12,
                    'completion_tokens' => 8,
                    'total_tokens' => 20,
                ],
            ], 200),
        ]);
    }

    public function test_ai_draft_requires_authentication(): void
    {
        $this->postJson('/api/mail/ai-draft', [
            'instruction' => 'Ask for the report',
        ])->assertUnauthorized();
    }

    public function test_ai_draft_requires_instruction(): void
    {
        $user = User::factory()->create(['is_approved' => true]);

        $this->withToken($this->token($user))
            ->postJson('/api/mail/ai-draft', [])
            ->assertStatus(422);
    }

    public function test_ai_draft_returns_subject_and_body_and_logs_usage(): void
    {
        $this->configureOpenRouter();
        $this->fakeOpenRouter(json_encode([
            'subject' => 'Q3 numbers',
            'body' => 'Please send the Q3 numbers by Friday.',
            'to' => '',
        ]));

        $user = User::factory()->create([
            'is_approved' => true,
            'full_name' => 'Ada Lovelace',
        ]);

        $this->withToken($this->token($user))
            ->postJson('/api/mail/ai-draft', [
                'instruction' => 'Ask for the Q3 numbers by Friday',
                'tone' => 'professional',
                'mode' => 'compose',
            ])
            ->assertOk()
            ->assertJson([
                'subject' => 'Q3 numbers',
                'body' => 'Please send the Q3 numbers by Friday.',
                'to' => '',
            ]);

        $this->assertDatabaseHas('llm_usage_logs', [
            'user_id' => $user->id,
            'feature' => MailAiDraftService::FEATURE,
            'ok' => 1,
            'total_tokens' => 20,
        ]);
        $this->assertNotNull(LlmUsageLog::query()->where('feature', MailAiDraftService::FEATURE)->value('input_text'));
    }

    public function test_ai_draft_asks_the_model_to_write_in_bahasa_melayu(): void
    {
        $this->configureOpenRouter();
        $this->fakeOpenRouter(json_encode([
            'subject' => 'Laporan Q3',
            'body' => 'Mohon hantar laporan Q3 sebelum Jumaat.',
            'to' => '',
        ]));

        $user = User::factory()->create(['is_approved' => true]);

        $this->withToken($this->token($user))
            ->postJson('/api/mail/ai-draft', [
                'instruction' => 'Minta laporan Q3 sebelum Jumaat',
                'language' => 'ms',
                'mode' => 'compose',
            ])
            ->assertOk();

        Http::assertSent(function ($request) {
            $messages = $request->data()['messages'] ?? [];
            $system = (string) ($messages[0]['content'] ?? '');
            $user = (string) ($messages[1]['content'] ?? '');

            return str_contains($system, 'Bahasa Melayu')
                && str_contains($system, 'Do not write the email in English')
                && str_contains($user, 'Language: ms');
        });
    }

    public function test_ai_draft_rejects_empty_model_body(): void
    {
        $this->configureOpenRouter();
        $this->fakeOpenRouter('not a draft');

        $user = User::factory()->create(['is_approved' => true]);

        $this->withToken($this->token($user))
            ->postJson('/api/mail/ai-draft', [
                'instruction' => 'Write a thank you',
            ])
            ->assertStatus(422)
            ->assertJsonFragment([
                'message' => 'The AI did not return an email draft. Try again with a clearer instruction.',
            ]);
    }
}
