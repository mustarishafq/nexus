<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\AssistantMessage;
use App\Models\User;
use App\Models\UserSystemAccess;
use App\Support\ApiTokenAuth;
use App\Support\AppSettings;
use App\Support\McpUserAccess;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AssistantApplicationsTest extends TestCase
{
    use RefreshDatabase;

    public function test_role_user_sees_assigned_mcp_enabled_apps_without_enabling_mcp(): void
    {
        $user = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'mcp_access' => McpUserAccess::NONE,
            'assistant_access' => McpUserAccess::READ,
        ]);
        $application = Application::factory()->create([
            'name' => 'EMZI Nexus Care',
            'slug' => 'nexus-care',
            'mcp_enabled' => true,
            'visibility' => 'public',
            'is_enabled' => true,
        ]);
        $access = UserSystemAccess::query()->create([
            'user_email' => $user->email,
        ]);
        $access->allowedApplications()->attach($application->id);

        $this->withToken(ApiTokenAuth::issueToken($user))
            ->getJson('/api/assistant/applications')
            ->assertOk()
            ->assertJsonCount(1, 'applications')
            ->assertJsonPath('applications.0.slug', 'nexus-care');
    }

    public function test_chat_saves_a_chart_and_spreadsheet_from_tool_calls(): void
    {
        Storage::fake('public');
        $existing = DB::table('app_settings')->first();
        $payload = [
            'openrouter_api_key' => 'test-key',
            'openrouter_model' => 'openai/gpt-4o-mini',
            'updated_at' => now(),
        ];
        if ($existing) {
            DB::table('app_settings')->where('id', $existing->id)->update($payload);
        } else {
            DB::table('app_settings')->insert($payload + ['created_at' => now()]);
        }
        AppSettings::forget();

        $user = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'assistant_access' => McpUserAccess::READ,
        ]);
        $application = Application::factory()->create([
            'name' => 'EMZI Nexus Care',
            'slug' => 'nexus-care',
            'mcp_enabled' => true,
            'visibility' => 'public',
            'is_enabled' => true,
        ]);
        $access = UserSystemAccess::query()->create([
            'user_email' => $user->email,
        ]);
        $access->allowedApplications()->attach($application->id);

        Http::fake(function ($request) {
            $messages = $request->data()['messages'] ?? [];
            $usage = [
                'prompt_tokens' => 10,
                'completion_tokens' => 5,
                'total_tokens' => 15,
            ];
            $hasToolResult = collect($messages)->contains(fn ($message) => ($message['role'] ?? '') === 'tool');
            if ($hasToolResult) {
                return Http::response([
                    'id' => 'gen',
                    'model' => 'openai/gpt-4o-mini',
                    'choices' => [[
                        'message' => [
                            'role' => 'assistant',
                            'content' => 'Here is the chart, and the file is attached.',
                        ],
                    ]],
                    'usage' => $usage,
                ]);
            }

            return Http::response([
                'id' => 'gen-tools',
                'model' => 'openai/gpt-4o-mini',
                'choices' => [[
                    'message' => [
                        'role' => 'assistant',
                        'content' => null,
                        'tool_calls' => [
                            [
                                'id' => 'call_chart',
                                'type' => 'function',
                                'function' => [
                                    'name' => 'present_chart',
                                    'arguments' => json_encode([
                                        'type' => 'pie',
                                        'title' => 'Status',
                                        'points' => [
                                            ['label' => 'Open', 'value' => 3],
                                            ['label' => 'Done', 'value' => 1],
                                        ],
                                    ]),
                                ],
                            ],
                            [
                                'id' => 'call_file',
                                'type' => 'function',
                                'function' => [
                                    'name' => 'create_spreadsheet',
                                    'arguments' => json_encode([
                                        'filename' => 'status',
                                        'format' => 'xlsx',
                                        'columns' => ['Status', 'Count'],
                                        'rows' => [['Open', 3], ['Done', 1]],
                                    ]),
                                ],
                            ],
                        ],
                    ],
                ]],
                'usage' => $usage,
            ]);
        });

        $this->withToken(ApiTokenAuth::issueToken($user))
            ->postJson('/api/assistant/chat', [
                'application_slug' => 'nexus-care',
                'message' => 'Chart the statuses and give me an Excel file',
            ])
            ->assertOk()
            ->assertJsonPath('assistant_message.visuals.0.type', 'pie')
            ->assertJsonPath('assistant_message.visuals.0.title', 'Status')
            ->assertJsonPath('assistant_message.attachments.0.name', 'status.xlsx')
            ->assertJsonPath('tool_steps.0.name', 'present_chart')
            ->assertJsonPath('tool_steps.1.name', 'create_spreadsheet');

        $stored = AssistantMessage::query()->where('role', 'assistant')->first();
        $path = ltrim(substr((string) ($stored->attachments[0]['url'] ?? ''), strlen('/storage/')), '/');
        Storage::disk('public')->assertExists($path);
    }
}
