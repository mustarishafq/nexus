<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\AttendanceRecord;
use App\Models\User;
use App\Services\ResourceAttendanceForwarder;
use Firebase\JWT\JWT;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

class NexusV1ResourceIntegrationTest extends TestCase
{
    use RefreshDatabase;

    private string $apiKey = 'resource-test-api-key-32chars-min!!';

    private function createResourceApplication(array $overrides = []): Application
    {
        return Application::factory()->create(array_merge([
            'name' => 'EMZI Nexus Resource',
            'slug' => 'emzi-nexus-resource',
            'base_url' => 'http://resource.test',
            'api_key' => $this->apiKey,
            'auth_mode' => 'jwt',
            'is_enabled' => true,
        ], $overrides));
    }

    private function serviceToken(string $audience): string
    {
        $now = time();

        return JWT::encode([
            'iss' => 'http://resource.test',
            'iat' => $now,
            'exp' => $now + 120,
            'sub' => 'system',
            'typ' => 'service',
            'aud' => $audience,
        ], $this->apiKey, 'HS256');
    }

    private function authHeaders(string $audience): array
    {
        return [
            'Authorization' => 'Bearer '.$this->serviceToken($audience),
            'X-Nexus-Api-Key' => $this->apiKey,
            'Accept' => 'application/json',
        ];
    }

    public function test_employees_export_requires_auth(): void
    {
        $this->createResourceApplication();

        $this->getJson('/api/nexus/v1/employees')
            ->assertUnauthorized();
    }

    public function test_employees_export_returns_roster(): void
    {
        $this->createResourceApplication();
        $user = User::factory()->create([
            'full_name' => 'Jane Doe',
            'email' => 'jane@example.com',
            'role' => 'user',
            'is_approved' => true,
            'employee_id' => 'E001',
            'job_title' => 'Engineer',
        ]);

        $response = $this->getJson('/api/nexus/v1/employees', $this->authHeaders('brain-employees'))
            ->assertOk();

        $employees = collect($response->json('employees'));
        $jane = $employees->firstWhere('email', 'jane@example.com');

        $this->assertNotNull($jane);
        $this->assertSame((string) $user->id, $jane['nexus_user_id']);
        $this->assertSame('E001', $jane['employee_id']);
        $this->assertSame('Engineer', $jane['job_title']);
    }

    public function test_employees_provision_creates_brain_user(): void
    {
        $this->createResourceApplication();

        $response = $this->postJson('/api/nexus/v1/employees', [
            'full_name' => 'New Hire',
            'email' => 'newhire@example.com',
            'role' => 'user',
            'employee_id' => 'E100',
            'job_title' => 'Analyst',
        ], $this->authHeaders('brain-employees'));

        $response->assertCreated()
            ->assertJsonPath('created', true)
            ->assertJsonPath('employee.email', 'newhire@example.com')
            ->assertJsonPath('employee.employee_id', 'E100');

        $this->assertNotEmpty($response->json('temporary_password'));
        $this->assertDatabaseHas('users', [
            'email' => 'newhire@example.com',
            'employee_id' => 'E100',
        ]);
    }

    public function test_employees_provision_links_existing_email(): void
    {
        $this->createResourceApplication();
        $existing = User::factory()->create([
            'email' => 'existing@example.com',
            'full_name' => 'Existing User',
        ]);

        $this->postJson('/api/nexus/v1/employees', [
            'full_name' => 'Existing User Updated',
            'email' => 'existing@example.com',
            'job_title' => 'Lead',
        ], $this->authHeaders('brain-employees'))
            ->assertOk()
            ->assertJsonPath('created', false)
            ->assertJsonPath('temporary_password', null)
            ->assertJsonPath('employee.nexus_user_id', (string) $existing->id)
            ->assertJsonPath('employee.job_title', 'Lead');
    }

    public function test_attendance_export_paginates_by_after_id(): void
    {
        $this->createResourceApplication();
        $user = User::factory()->create(['email' => 'punch@example.com']);

        $first = AttendanceRecord::query()->create([
            'user_id' => $user->id,
            'type' => 'clock_in',
            'photo_url' => '/storage/a.jpg',
            'captured_at' => now()->subHour(),
        ]);
        $second = AttendanceRecord::query()->create([
            'user_id' => $user->id,
            'type' => 'clock_out',
            'photo_url' => '/storage/b.jpg',
            'captured_at' => now(),
        ]);

        $page1 = $this->getJson('/api/nexus/v1/attendance?limit=1', $this->authHeaders('brain-attendance'))
            ->assertOk()
            ->assertJsonPath('records.0.external_id', (string) $first->id)
            ->assertJsonPath('pagination.has_more', true);

        $afterId = $page1->json('pagination.after_id');

        $this->getJson('/api/nexus/v1/attendance?limit=1&after_id='.$afterId, $this->authHeaders('brain-attendance'))
            ->assertOk()
            ->assertJsonPath('records.0.external_id', (string) $second->id)
            ->assertJsonPath('records.0.email', 'punch@example.com')
            ->assertJsonPath('pagination.has_more', false);
    }

    public function test_attendance_forwarder_posts_ingest_payload(): void
    {
        $this->createResourceApplication();
        $user = User::factory()->create(['email' => 'clock@example.com']);
        $record = AttendanceRecord::query()->create([
            'user_id' => $user->id,
            'type' => 'clock_in',
            'photo_url' => '/storage/selfie.jpg',
            'latitude' => 3.14,
            'longitude' => 101.68,
            'location_label' => 'HQ',
            'captured_at' => now(),
            'metadata' => ['policy' => ['ok' => true]],
        ]);

        Http::fake([
            'http://resource.test/.well-known/nexus-integration.json' => Http::response([
                'name' => 'EMZI Nexus Resource',
                'capabilities' => ['attendance.ingest'],
                'endpoints' => [
                    'attendance_ingest' => '/api/nexus/v1/attendance/ingest',
                ],
            ]),
            'http://resource.test/api/nexus/v1/attendance/ingest' => Http::response(['ok' => true], 201),
        ]);

        app(ResourceAttendanceForwarder::class)->forward($record, $user);

        Http::assertSent(function ($request) {
            return $request->url() === 'http://resource.test/api/nexus/v1/attendance/ingest'
                && $request['email'] === 'clock@example.com'
                && $request['type'] === 'clock_in'
                && $request->hasHeader('X-Nexus-Api-Key', $this->apiKey);
        });
    }

    public function test_attendance_forwarder_fail_soft_on_ingest_error(): void
    {
        $this->createResourceApplication();
        $user = User::factory()->create(['email' => 'clock@example.com']);
        $record = AttendanceRecord::query()->create([
            'user_id' => $user->id,
            'type' => 'clock_out',
            'photo_url' => '/storage/selfie.jpg',
            'captured_at' => now(),
        ]);

        Http::fake([
            'http://resource.test/.well-known/nexus-integration.json' => Http::response([
                'capabilities' => ['attendance.ingest'],
                'endpoints' => ['attendance_ingest' => '/api/nexus/v1/attendance/ingest'],
            ]),
            'http://resource.test/api/nexus/v1/attendance/ingest' => Http::response(['message' => 'boom'], 500),
        ]);

        Log::spy();

        app(ResourceAttendanceForwarder::class)->forward($record, $user);

        Log::shouldHaveReceived('warning')->withArgs(function ($message) {
            return $message === 'Resource attendance ingest failed';
        })->once();
    }
}
