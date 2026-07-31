<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\AttendanceRecord;
use App\Models\User;
use App\Services\ResourceAttendanceForwarder;
use App\Services\ResourceAttendancePolicyForwarder;
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
        $manager = User::factory()->create([
            'full_name' => 'Manager One',
            'email' => 'manager@example.com',
            'role' => 'user',
            'is_approved' => true,
            'job_title' => 'Lead',
        ]);
        $user = User::factory()->create([
            'full_name' => 'Jane Doe',
            'email' => 'jane@example.com',
            'role' => 'user',
            'is_approved' => true,
            'employee_id' => 'E001',
            'job_title' => 'Engineer',
            'work_phone' => '+60123456789',
            'gender' => 'female',
            'ic_number' => '900101-01-1234',
            'manager_id' => $manager->id,
            'current_address' => 'Kuala Lumpur',
        ]);
        $user->educations()->create([
            'institution' => 'UM',
            'qualification' => 'BSc',
            'field_of_study' => 'CS',
            'year_from' => '2010',
            'year_to' => '2014',
            'sort_order' => 0,
        ]);
        $user->userSkills()->create([
            'name' => 'PHP',
            'sort_order' => 0,
        ]);

        $response = $this->getJson('/api/nexus/v1/employees', $this->authHeaders('brain-employees'))
            ->assertOk();

        $employees = collect($response->json('employees'));
        $jane = $employees->firstWhere('email', 'jane@example.com');

        $this->assertNotNull($jane);
        $this->assertSame((string) $user->id, $jane['nexus_user_id']);
        $this->assertSame('E001', $jane['employee_id']);
        $this->assertSame('Engineer', $jane['job_title']);
        $this->assertSame('+60123456789', $jane['work_phone']);
        $this->assertSame('female', $jane['gender']);
        $this->assertSame('900101-01-1234', $jane['ic_number']);
        $this->assertSame('Kuala Lumpur', $jane['current_address']);
        $this->assertSame((string) $manager->id, $jane['manager_nexus_user_id']);
        $this->assertSame('PHP', $jane['skills'][0] ?? null);
        $this->assertSame('UM', $jane['education_history'][0]['institution'] ?? null);
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

    public function test_employees_put_updates_profile_from_resource(): void
    {
        $this->createResourceApplication();
        $user = User::factory()->create([
            'full_name' => 'Jane Doe',
            'email' => 'jane-sync@example.com',
            'job_title' => 'Old Title',
            'work_phone' => null,
        ]);

        $this->putJson('/api/nexus/v1/employees', [
            'employees' => [
                [
                    'nexus_user_id' => (string) $user->id,
                    'email' => 'jane-sync@example.com',
                    'name' => 'Jane',
                    'full_name' => 'Jane Doe',
                    'role' => 'user',
                    'is_approved' => true,
                    'job_title' => 'Senior Engineer',
                    'work_phone' => '+60123456789',
                    'gender' => 'female',
                    'ic_number' => '900101-01-1234',
                    'skills' => ['PHP', 'Laravel'],
                    'education_history' => [
                        [
                            'institution' => 'UM',
                            'qualification' => 'BSc',
                            'field_of_study' => 'CS',
                            'year_from' => '2010',
                            'year_to' => '2014',
                        ],
                    ],
                ],
            ],
        ], $this->authHeaders('brain-employees'))
            ->assertOk()
            ->assertJsonPath('stats.updated', 1);

        $user->refresh();
        $this->assertSame('Senior Engineer', $user->job_title);
        $this->assertSame('+60123456789', $user->work_phone);
        $this->assertSame('female', $user->gender);
        $this->assertSame('900101-01-1234', $user->ic_number);
        $this->assertSame(['PHP', 'Laravel'], $user->fresh()->load('userSkills')->skillsList());
        $this->assertSame('UM', $user->fresh()->load('educations')->educationHistoryList()[0]['institution'] ?? null);
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

    public function test_attendance_forwarder_posts_when_well_known_blocked_for_named_app(): void
    {
        $this->createResourceApplication([
            'name' => 'EMZI Nexus Kashfi',
            'slug' => 'emzi-nexus-kashfi',
        ]);
        $user = User::factory()->create(['email' => 'clock@example.com']);
        $record = AttendanceRecord::query()->create([
            'user_id' => $user->id,
            'type' => 'clock_out',
            'photo_url' => '/storage/selfie.jpg',
            'captured_at' => now(),
        ]);

        Http::fake([
            'http://resource.test/.well-known/nexus-integration.json' => Http::response('Forbidden', 403),
            'http://resource.test/api/nexus/v1/attendance/ingest' => Http::response(['ok' => true], 201),
        ]);

        app(ResourceAttendanceForwarder::class)->forward($record, $user);

        Http::assertSent(fn ($request) => $request->url() === 'http://resource.test/api/nexus/v1/attendance/ingest'
            && $request['type'] === 'clock_out');
    }

    public function test_attendance_policy_push_uses_default_path_when_well_known_blocked(): void
    {
        $this->createResourceApplication([
            'name' => 'EMZI Nexus Insan',
            'slug' => 'emzi-nexus-insan',
            'base_url' => 'https://insan.example.test',
        ]);

        Http::fake([
            'https://insan.example.test/.well-known/nexus-integration.json' => Http::response('Forbidden', 403),
            'https://insan.example.test/api/nexus/v1/attendance/policy' => Http::response([
                'message' => 'Attendance policy applied',
                'stats' => ['locations_upserted' => 0, 'departments_upserted' => 0],
            ], 200),
        ]);

        $result = app(ResourceAttendancePolicyForwarder::class)->push();

        $this->assertTrue($result['ok'] ?? false);
        Http::assertSent(function ($request) {
            return $request->method() === 'PUT'
                && $request->url() === 'https://insan.example.test/api/nexus/v1/attendance/policy'
                && $request->hasHeader('X-Nexus-Api-Key', $this->apiKey)
                && ($request['prune_missing'] ?? false) === true;
        });
    }

    public function test_attendance_policy_upsert_by_name(): void
    {
        $this->createResourceApplication();
        \App\Models\Department::query()->create(['name' => 'Operations']);

        $response = $this->putJson('/api/nexus/v1/attendance/policy', [
            'locations' => [[
                'name' => 'EMZI HQ',
                'geofence_enabled' => true,
                'center_latitude' => 5.64,
                'center_longitude' => 100.48,
                'radius_meters' => 150,
                'allow_outside_radius' => true,
                'allow_clock_out_outside_radius' => false,
                'sites' => [[
                    'name' => 'Primary',
                    'latitude' => 5.64,
                    'longitude' => 100.48,
                ]],
            ]],
            'departments' => [[
                'department_name' => 'Operations',
                'enabled' => true,
                'location_name' => 'EMZI HQ',
                'timezone' => 'Asia/Kuala_Lumpur',
                'grace_period_minutes' => 10,
                'allow_outside_shift_hours' => false,
                'overtime_enabled' => true,
                'standard_hours_per_day' => 8,
                'overtime_threshold_minutes' => 0,
                'shifts' => [[
                    'name' => 'Day',
                    'days_of_week' => [1, 2, 3, 4, 5],
                    'start_time' => '09:00',
                    'end_time' => '18:00',
                    'crosses_midnight' => false,
                ]],
            ]],
            'watermark' => [
                'enabled' => true,
                'show_user_name' => true,
                'show_location' => false,
                'custom_text' => 'Synced watermark',
                'show_custom_text' => true,
            ],
            'prune_missing' => true,
        ], $this->authHeaders('brain-attendance-policy'));

        $response->assertOk()
            ->assertJsonPath('stats.locations_upserted', 1)
            ->assertJsonPath('stats.departments_upserted', 1)
            ->assertJsonPath('stats.watermark_updated', true);

        $this->assertDatabaseHas('attendance_locations', [
            'name' => 'EMZI HQ',
            'radius_meters' => 150,
            'allow_outside_radius' => true,
            'allow_clock_out_outside_radius' => false,
        ]);
        $this->assertDatabaseHas('department_attendance_settings', ['grace_period_minutes' => 10]);

        $export = $this->getJson('/api/nexus/v1/attendance/policy', $this->authHeaders('brain-attendance-policy'))
            ->assertOk();

        $this->assertSame('EMZI HQ', $export->json('locations.0.name'));
        $this->assertTrue($export->json('locations.0.allow_outside_radius'));
        $this->assertFalse($export->json('locations.0.allow_clock_out_outside_radius'));
        $this->assertSame('Operations', $export->json('departments.0.department_name'));
        $this->assertFalse($export->json('watermark.show_location'));
    }

    public function test_attendance_policy_requires_auth(): void
    {
        $this->createResourceApplication();

        $this->putJson('/api/nexus/v1/attendance/policy', [
            'locations' => [],
            'departments' => [],
        ])->assertUnauthorized();
    }
}
