<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\LlmUsageLog;
use App\Models\User;
use App\Services\ApplicationApiClient;
use App\Support\AppSettings;
use Firebase\JWT\JWT;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class SatelliteAiProviderTest extends TestCase
{
    use RefreshDatabase;

    private string $apiKey = 'campus-test-api-key-32chars-min!!!';

    private function createCampusApplication(array $overrides = []): Application
    {
        return Application::factory()->create(array_merge([
            'name' => 'EMZI Nexus Campus',
            'slug' => 'emzi-nexus-campus',
            'base_url' => 'http://campus.test',
            'api_key' => $this->apiKey,
            'auth_mode' => 'jwt',
            'is_enabled' => true,
            'ai_enabled' => true,
        ], $overrides));
    }

    private function authHeaders(): array
    {
        $now = time();
        $token = JWT::encode([
            'iss' => 'http://campus.test',
            'iat' => $now,
            'exp' => $now + 120,
            'sub' => 'system',
            'typ' => 'service',
            'aud' => 'brain-ai',
        ], $this->apiKey, 'HS256');

        return [
            'Authorization' => 'Bearer '.$token,
            'X-Nexus-Api-Key' => $this->apiKey,
            'Accept' => 'application/json',
        ];
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

    private function fakeOpenRouter(string $content = '{"ok":true}'): void
    {
        Http::fake([
            'https://openrouter.ai/api/v1/chat/completions' => Http::response([
                'id' => 'gen-satellite',
                'model' => 'openai/gpt-4o-mini',
                'choices' => [[
                    'message' => [
                        'role' => 'assistant',
                        'content' => $content,
                    ],
                ]],
                'usage' => [
                    'prompt_tokens' => 9,
                    'completion_tokens' => 4,
                    'total_tokens' => 13,
                ],
            ], 200),
        ]);
    }

    public function test_chat_requires_auth(): void
    {
        $this->createCampusApplication();

        $this->postJson('/api/nexus/v1/ai/chat/completions', [
            'messages' => [['role' => 'user', 'content' => 'Hello']],
        ])->assertUnauthorized();
    }

    public function test_chat_requires_ai_enabled(): void
    {
        $this->createCampusApplication(['ai_enabled' => false]);
        $this->configureOpenRouter();

        $this->postJson('/api/nexus/v1/ai/chat/completions', [
            'messages' => [['role' => 'user', 'content' => 'Hello']],
        ], $this->authHeaders())
            ->assertForbidden()
            ->assertJsonPath('message', 'This application is not enabled to use Brain as an AI provider.');
    }

    public function test_chat_forwards_to_openrouter_and_logs_usage(): void
    {
        $this->createCampusApplication();
        $this->configureOpenRouter();
        $this->fakeOpenRouter('{"title":"Safety 101"}');

        $this->postJson('/api/nexus/v1/ai/chat/completions', [
            'messages' => [
                ['role' => 'system', 'content' => 'Return JSON'],
                ['role' => 'user', 'content' => 'Draft a course'],
            ],
            'response_format' => ['type' => 'json_object'],
            'tools' => [['type' => 'function', 'function' => ['name' => 'ignored']]],
        ], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('choices.0.message.content', '{"title":"Safety 101"}');

        Http::assertSent(function ($request) {
            $body = $request->data();

            return ($body['model'] ?? null) === 'openai/gpt-4o-mini'
                && ($body['response_format']['type'] ?? null) === 'json_object'
                && ! isset($body['tools']);
        });

        $log = LlmUsageLog::query()->first();
        $this->assertNotNull($log);
        $this->assertSame('satellite_ai', $log->feature);
        $this->assertSame('emzi-nexus-campus', $log->application_slug);
        $this->assertTrue((bool) $log->ok);
        $this->assertNull($log->user_id);
        $this->assertStringContainsString('Draft a course', (string) $log->input_text);
    }

    public function test_chat_logs_acting_user_from_header(): void
    {
        $this->createCampusApplication();
        $this->configureOpenRouter();
        $this->fakeOpenRouter('{"ok":true}');
        $user = User::factory()->create([
            'name' => 'Alex Instructor',
            'email' => 'alex@example.com',
        ]);

        $this->postJson('/api/nexus/v1/ai/chat/completions', [
            'messages' => [['role' => 'user', 'content' => 'Draft a course']],
        ], array_merge($this->authHeaders(), [
            ApplicationApiClient::ACTING_USER_ID_HEADER => (string) $user->id,
        ]))->assertOk();

        $log = LlmUsageLog::query()->first();
        $this->assertNotNull($log);
        $this->assertSame($user->id, $log->user_id);
    }

    public function test_rejects_non_default_model(): void
    {
        $this->createCampusApplication();
        $this->configureOpenRouter();

        $this->postJson('/api/nexus/v1/ai/chat/completions', [
            'messages' => [['role' => 'user', 'content' => 'Hello']],
            'model' => 'openai/gpt-4o',
        ], $this->authHeaders())
            ->assertStatus(422);
    }

    public function test_inlines_markdown_attachment(): void
    {
        $this->createCampusApplication();
        $this->configureOpenRouter();
        $this->fakeOpenRouter('ok');

        $this->postJson('/api/nexus/v1/ai/chat/completions', [
            'messages' => [['role' => 'user', 'content' => 'Use the file']],
            'attachments' => [[
                'filename' => 'notes.md',
                'media_type' => 'text/markdown',
                'data' => base64_encode('# Module 1'),
            ]],
        ], $this->authHeaders())->assertOk();

        Http::assertSent(function ($request) {
            $content = $request->data()['messages'][0]['content'] ?? [];

            return is_array($content)
                && str_contains((string) ($content[1]['text'] ?? ''), '# Module 1');
        });
    }

    public function test_multipart_file_upload(): void
    {
        $this->createCampusApplication();
        $this->configureOpenRouter();
        $this->fakeOpenRouter('ok');

        $file = UploadedFile::fake()->createWithContent('syllabus.txt', 'Week 1: intro');

        $this->post('/api/nexus/v1/ai/chat/completions', [
            'payload' => json_encode([
                'messages' => [['role' => 'user', 'content' => 'Draft from file']],
            ]),
            'files' => [$file],
        ], $this->authHeaders())->assertOk();

        Http::assertSent(function ($request) {
            $content = $request->data()['messages'][0]['content'] ?? [];

            return is_array($content)
                && str_contains((string) ($content[1]['text'] ?? ''), 'Week 1: intro');
        });
    }

    public function test_models_returns_default(): void
    {
        $this->createCampusApplication();
        $this->configureOpenRouter();

        $this->getJson('/api/nexus/v1/ai/models', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('data.0.id', 'openai/gpt-4o-mini');
    }
}
