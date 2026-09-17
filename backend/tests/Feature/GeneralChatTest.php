<?php

namespace Tests\Feature;

use App\Models\LlmUsageLog;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Services\PermissionService;
use App\Support\ApiTokenAuth;
use App\Support\AppSettings;
use App\Support\GeneralChatSettings;
use App\Support\PermissionCatalog;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class GeneralChatTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function token(User $user): string
    {
        return ApiTokenAuth::issueToken($user);
    }

    private function configureChat(array $overrides = []): void
    {
        $payload = array_merge([
            'system_name' => 'EMZI Nexus Brain',
            'openrouter_api_key' => 'test-key',
            'openrouter_model' => 'openai/gpt-4o-mini',
            'general_chat_token_limit' => 1000,
            'general_chat_reset_period' => 'monthly',
            'general_chat_reset_time' => '00:00',
            'general_chat_reset_weekday' => 1,
            'general_chat_reset_month_day' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ], $overrides);

        $existing = DB::table('app_settings')->first();
        if ($existing) {
            DB::table('app_settings')->where('id', $existing->id)->update($payload);
        } else {
            DB::table('app_settings')->insert($payload);
        }

        AppSettings::forget();
    }

    private function fakeOpenRouter(int $totalTokens = 15, array $extractSave = []): void
    {
        Http::fake([
            'https://openrouter.ai/api/v1/chat/completions' => function ($request) use ($totalTokens, $extractSave) {
                $system = (string) ($request->data()['messages'][0]['content'] ?? '');
                $usage = [
                    'prompt_tokens' => 10,
                    'completion_tokens' => 5,
                    'total_tokens' => $totalTokens,
                ];

                if (str_contains($system, 'chat thread title')) {
                    return Http::response([
                        'id' => 'gen-title',
                        'model' => 'openai/gpt-4o-mini',
                        'choices' => [[
                            'message' => [
                                'role' => 'assistant',
                                'content' => 'Helpful Topic Summary',
                            ],
                        ]],
                        'usage' => $usage,
                    ], 200);
                }

                if (str_contains($system, 'durable personal facts')) {
                    return Http::response([
                        'id' => 'gen-memory',
                        'model' => 'openai/gpt-4o-mini',
                        'choices' => [[
                            'message' => [
                                'role' => 'assistant',
                                'content' => json_encode([
                                    'save' => $extractSave,
                                    'forget' => [],
                                ]),
                            ],
                        ]],
                        'usage' => $usage,
                    ], 200);
                }

                return Http::response([
                    'id' => 'gen-test',
                    'model' => 'openai/gpt-4o-mini',
                    'choices' => [[
                        'message' => [
                            'role' => 'assistant',
                            'content' => 'Hello from chat.',
                        ],
                    ]],
                    'usage' => $usage,
                ], 200);
            },
        ]);
    }

    public function test_user_inherits_global_limit(): void
    {
        $this->configureChat(['general_chat_token_limit' => 2500]);
        $user = User::factory()->create(['is_approved' => true, 'role' => 'user']);

        $this->withToken($this->token($user))
            ->getJson('/api/general-chat/quota')
            ->assertOk()
            ->assertJsonPath('quota.inherited_limit', 2500)
            ->assertJsonPath('quota.individual_limit', null)
            ->assertJsonPath('quota.effective_limit', 2500)
            ->assertJsonPath('quota.used', 0)
            ->assertJsonPath('quota.remaining', 2500)
            ->assertJsonPath('quota.blocked', false);
    }

    public function test_individual_limit_overrides_global(): void
    {
        $this->configureChat(['general_chat_token_limit' => 2500]);
        $user = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'general_chat_token_limit' => 100,
        ]);

        $this->withToken($this->token($user))
            ->getJson('/api/general-chat/quota')
            ->assertOk()
            ->assertJsonPath('quota.base_limit', 100)
            ->assertJsonPath('quota.effective_limit', 100)
            ->assertJsonPath('quota.remaining', 100);
    }

    public function test_chat_is_blocked_when_remaining_is_zero(): void
    {
        $this->configureChat(['general_chat_token_limit' => 20]);
        $user = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $this->fakeOpenRouter();

        LlmUsageLog::query()->create([
            'user_id' => $user->id,
            'feature' => GeneralChatSettings::FEATURE,
            'total_tokens' => 20,
            'ok' => true,
        ]);

        $this->withToken($this->token($user))
            ->postJson('/api/general-chat/chat', ['message' => 'Hi'])
            ->assertStatus(429)
            ->assertJsonPath('quota.blocked', true);

        Http::assertNothingSent();
    }

    public function test_topup_restores_access_for_current_period(): void
    {
        $this->configureChat(['general_chat_token_limit' => 10]);
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $user = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $this->fakeOpenRouter();

        LlmUsageLog::query()->create([
            'user_id' => $user->id,
            'feature' => GeneralChatSettings::FEATURE,
            'total_tokens' => 10,
            'ok' => true,
        ]);

        $this->withToken($this->token($user))
            ->postJson('/api/general-chat/chat', ['message' => 'Hi'])
            ->assertStatus(429);

        $this->withToken($this->token($admin))
            ->postJson('/api/admin/users/'.$user->id.'/general-chat-topup', [
                'tokens' => 50,
                'note' => 'One-off',
            ])
            ->assertOk()
            ->assertJsonPath('quota.grant_tokens', 50)
            ->assertJsonPath('quota.remaining', 50);

        $this->withToken($this->token($user))
            ->postJson('/api/general-chat/chat', ['message' => 'Hi again'])
            ->assertOk()
            ->assertJsonPath('assistant_message.content', 'Hello from chat.');
    }

    public function test_new_period_zeros_usage_and_expires_topups(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-17 12:00:00', 'Asia/Kuala_Lumpur'));
        $this->configureChat([
            'general_chat_token_limit' => 100,
            'general_chat_reset_period' => 'daily',
            'general_chat_reset_time' => '00:00',
        ]);
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $user = User::factory()->create(['is_approved' => true, 'role' => 'user']);

        LlmUsageLog::query()->create([
            'user_id' => $user->id,
            'feature' => GeneralChatSettings::FEATURE,
            'total_tokens' => 40,
            'ok' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->withToken($this->token($admin))
            ->postJson('/api/admin/users/'.$user->id.'/general-chat-topup', ['tokens' => 25])
            ->assertOk()
            ->assertJsonPath('quota.used', 40)
            ->assertJsonPath('quota.grant_tokens', 25)
            ->assertJsonPath('quota.remaining', 85);

        Carbon::setTestNow(Carbon::parse('2026-09-18 12:00:00', 'Asia/Kuala_Lumpur'));

        $this->withToken($this->token($user))
            ->getJson('/api/general-chat/quota')
            ->assertOk()
            ->assertJsonPath('quota.used', 0)
            ->assertJsonPath('quota.grant_tokens', 0)
            ->assertJsonPath('quota.remaining', 100);
    }

    public function test_chat_sends_no_tools_to_openrouter(): void
    {
        $this->configureChat();
        $user = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $this->fakeOpenRouter();

        $this->withToken($this->token($user))
            ->postJson('/api/general-chat/chat', ['message' => 'What is 2+2?'])
            ->assertOk();

        Http::assertSent(function ($request) {
            $body = $request->data();
            $hasNoTools = ! array_key_exists('tools', $body) || $body['tools'] === [];
            $system = (string) ($body['messages'][0]['content'] ?? '');

            return $request->url() === 'https://openrouter.ai/api/v1/chat/completions'
                && $hasNoTools
                && str_contains($system, 'no tools')
                && str_contains(strtolower($system), 'security');
        });

        $this->assertDatabaseHas('llm_usage_logs', [
            'user_id' => $user->id,
            'feature' => GeneralChatSettings::FEATURE,
            'total_tokens' => 15,
        ]);
    }

    public function test_admin_can_set_individual_limit(): void
    {
        $this->configureChat(['general_chat_token_limit' => 1000]);
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $user = User::factory()->create(['is_approved' => true, 'role' => 'user']);

        $this->withToken($this->token($admin))
            ->patchJson('/api/admin/users/'.$user->id.'/general-chat-quota', [
                'token_limit' => 42,
            ])
            ->assertOk()
            ->assertJsonPath('quota.individual_limit', 42)
            ->assertJsonPath('quota.effective_limit', 42);
    }

    public function test_forbidden_without_permission(): void
    {
        $user = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $role = Role::query()->where('slug', 'user')->first();
        $permissionId = Permission::query()->where('key', PermissionCatalog::GENERAL_CHAT_USE)->value('id');
        if ($role && $permissionId) {
            $role->permissions()->detach($permissionId);
            PermissionService::flush();
        }

        $this->withToken($this->token($user))
            ->getJson('/api/general-chat/quota')
            ->assertForbidden();
    }

    public function test_user_can_have_multiple_conversations_and_pin_one(): void
    {
        $this->configureChat();
        $user = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $this->fakeOpenRouter();

        $first = $this->withToken($this->token($user))
            ->postJson('/api/general-chat/chat', ['message' => 'First thread question'])
            ->assertOk()
            ->json('conversation.id');

        $second = $this->withToken($this->token($user))
            ->postJson('/api/general-chat/chat', ['message' => 'Second thread question'])
            ->assertOk()
            ->json('conversation.id');

        $this->assertNotSame($first, $second);

        $this->withToken($this->token($user))
            ->patchJson('/api/general-chat/conversations/'.$first, ['pinned' => true])
            ->assertOk()
            ->assertJsonPath('conversation.pinned', true);

        $this->withToken($this->token($user))
            ->getJson('/api/general-chat/conversations')
            ->assertOk()
            ->assertJsonPath('conversations.0.id', $first)
            ->assertJsonPath('conversations.0.pinned', true)
            ->assertJsonPath('conversations.1.id', $second);

        $this->withToken($this->token($user))
            ->getJson('/api/general-chat/conversations/'.$first)
            ->assertOk()
            ->assertJsonPath('messages.0.content', 'First thread question');

        $this->withToken($this->token($user))
            ->getJson('/api/general-chat/conversations')
            ->assertOk()
            ->assertJsonPath('conversations.0.title', 'Helpful Topic Summary');
    }

    public function test_user_cannot_open_someone_elses_conversation(): void
    {
        $this->configureChat();
        $owner = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $other = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $this->fakeOpenRouter();

        $conversationId = $this->withToken($this->token($owner))
            ->postJson('/api/general-chat/chat', ['message' => 'Private thread question'])
            ->assertOk()
            ->json('conversation.id');

        $this->withToken($this->token($other))
            ->getJson('/api/general-chat/conversations/'.$conversationId)
            ->assertForbidden();
    }

    public function test_chat_stores_attachments_and_sends_file_text(): void
    {
        $this->configureChat();
        $user = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $this->fakeOpenRouter();

        Storage::fake('public');
        Storage::disk('public')->put('general-chat/note.txt', 'Project Phoenix uses Laravel.');

        $this->withToken($this->token($user))
            ->postJson('/api/general-chat/chat', [
                'message' => 'Summarize the attached file please.',
                'attachments' => [[
                    'url' => '/storage/general-chat/note.txt',
                    'name' => 'note.txt',
                    'mime' => 'text/plain',
                    'size' => 28,
                ]],
            ])
            ->assertOk()
            ->assertJsonPath('user_message.attachments.0.name', 'note.txt');

        Http::assertSent(function ($request) {
            return str_contains((string) json_encode($request->data()), 'Project Phoenix uses Laravel.');
        });
    }

    public function test_chat_embeds_attached_images_for_the_model(): void
    {
        $this->configureChat();
        $user = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $this->fakeOpenRouter();

        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', true);
        $this->assertNotFalse($png);

        Storage::fake('public');
        Storage::disk('public')->put('general-chat/shot.png', $png);

        $this->withToken($this->token($user))
            ->postJson('/api/general-chat/chat', [
                'message' => 'boleh baca attachment ?',
                'attachments' => [[
                    'url' => '/storage/general-chat/shot.png',
                    'name' => 'shot.png',
                    'mime' => 'image/png',
                    'size' => strlen($png),
                ]],
            ])
            ->assertOk();

        Http::assertSent(function ($request) {
            $system = (string) ($request->data()['messages'][0]['content'] ?? '');
            if (str_contains($system, 'chat thread title') || str_contains($system, 'durable personal facts')) {
                return false;
            }

            foreach ($request->data()['messages'] ?? [] as $message) {
                if (($message['role'] ?? '') !== 'user' || ! is_array($message['content'] ?? null)) {
                    continue;
                }
                foreach ($message['content'] as $part) {
                    if (($part['type'] ?? '') === 'image_url') {
                        return str_starts_with((string) ($part['image_url']['url'] ?? ''), 'data:image/');
                    }
                }
            }

            return false;
        });
    }

    public function test_memory_is_extracted_and_injected_into_later_chats(): void
    {
        $this->configureChat();
        $user = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $this->fakeOpenRouter(15, ['Prefers concise answers']);

        $this->withToken($this->token($user))
            ->postJson('/api/general-chat/chat', ['message' => 'Please remember I prefer concise answers'])
            ->assertOk()
            ->assertJsonPath('memories.0.body', 'Prefers concise answers');

        $this->withToken($this->token($user))
            ->postJson('/api/general-chat/chat', ['message' => 'What should my next email sound like?'])
            ->assertOk();

        Http::assertSent(function ($request) {
            $system = (string) ($request->data()['messages'][0]['content'] ?? '');

            return str_contains($system, 'Prefers concise answers');
        });

        $memoryId = $this->withToken($this->token($user))
            ->getJson('/api/general-chat/memories')
            ->assertOk()
            ->json('memories.0.id');

        $this->withToken($this->token($user))
            ->deleteJson('/api/general-chat/memories/'.$memoryId)
            ->assertOk()
            ->assertJsonPath('memories', []);
    }

    public function test_memories_can_be_exported_as_markdown(): void
    {
        $this->configureChat();
        $user = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'full_name' => 'Aisyah',
        ]);
        $this->fakeOpenRouter(15, ['Prefers concise answers']);

        $this->withToken($this->token($user))
            ->postJson('/api/general-chat/chat', ['message' => 'Please remember I prefer concise answers'])
            ->assertOk();

        $response = $this->withToken($this->token($user))
            ->get('/api/general-chat/memories/export')
            ->assertOk();

        $this->assertStringContainsString('text/markdown', (string) $response->headers->get('content-type'));
        $this->assertStringContainsString('.md', (string) $response->headers->get('content-disposition'));
        $this->assertStringContainsString('# Chat memory', $response->getContent());
        $this->assertStringContainsString('- Prefers concise answers', $response->getContent());
        $this->assertStringContainsString('Aisyah', $response->getContent());
    }

    public function test_user_can_add_and_import_memories_manually(): void
    {
        $this->configureChat();
        $user = User::factory()->create(['is_approved' => true, 'role' => 'user']);

        $this->withToken($this->token($user))
            ->postJson('/api/general-chat/memories', ['body' => 'Lives in Kuala Lumpur'])
            ->assertCreated()
            ->assertJsonPath('memories.0.body', 'Lives in Kuala Lumpur');

        $this->withToken($this->token($user))
            ->postJson('/api/general-chat/memories/import', [
                'markdown' => "# Chat memory\n\n- Prefers tea\n- Writes in Malay\n",
            ])
            ->assertOk();

        $bodies = $this->withToken($this->token($user))
            ->getJson('/api/general-chat/memories')
            ->assertOk()
            ->json('memories');

        $this->assertContains('Lives in Kuala Lumpur', array_column($bodies, 'body'));
        $this->assertContains('Prefers tea', array_column($bodies, 'body'));
        $this->assertContains('Writes in Malay', array_column($bodies, 'body'));
    }

    public function test_auto_memory_can_be_turned_off_and_loaded_per_chat(): void
    {
        $this->configureChat();
        $user = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $this->fakeOpenRouter();

        $this->withToken($this->token($user))
            ->postJson('/api/general-chat/memories', ['body' => 'Prefers tea'])
            ->assertCreated();

        $this->withToken($this->token($user))
            ->patchJson('/api/general-chat/memory-settings', ['auto_memory' => false])
            ->assertOk()
            ->assertJsonPath('auto_memory', false);

        $conversationId = $this->withToken($this->token($user))
            ->postJson('/api/general-chat/chat', ['message' => 'What should I drink today?'])
            ->assertOk()
            ->json('conversation.id');

        Http::assertSent(function ($request) {
            $system = (string) ($request->data()['messages'][0]['content'] ?? '');
            if (str_contains($system, 'chat thread title') || str_contains($system, 'durable personal facts')) {
                return false;
            }

            return ($request->data()['messages'][0]['role'] ?? '') === 'system'
                && ! str_contains($system, 'Prefers tea');
        });

        $this->withToken($this->token($user))
            ->patchJson('/api/general-chat/conversations/'.$conversationId, ['use_memory' => true])
            ->assertOk()
            ->assertJsonPath('conversation.memory_active', true);

        $this->withToken($this->token($user))
            ->postJson('/api/general-chat/chat', [
                'conversation_id' => $conversationId,
                'message' => 'What should I drink with lunch?',
            ])
            ->assertOk();

        Http::assertSent(function ($request) {
            $system = (string) ($request->data()['messages'][0]['content'] ?? '');

            return str_contains($system, 'Prefers tea');
        });
    }
}
