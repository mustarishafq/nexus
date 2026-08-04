<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\AttendanceLocation;
use App\Models\Department;
use App\Models\DepartmentAttendanceSetting;
use App\Models\User;
use App\Support\ApiTokenAuth;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class SpecialReleaseClockInTest extends TestCase
{
    use RefreshDatabase;

    private string $apiKey = 'resource-test-api-key-32chars-min!!';

    private float $officeLat = 5.6400000;

    private float $officeLng = 100.4800000;

    private float $homeLat = 3.1390000;

    private float $homeLng = 101.6869000;

    private function createInsanApplication(): Application
    {
        return Application::factory()->create([
            'name' => 'EMZI Nexus Insan',
            'slug' => 'emzi-nexus-insan',
            'base_url' => 'http://resource.test',
            'api_key' => $this->apiKey,
            'auth_mode' => 'jwt',
            'is_enabled' => true,
        ]);
    }

    /**
     * @return array{0: User, 1: DepartmentAttendanceSetting}
     */
    private function makeEmployeeWithGeofence(bool $allowOutsideRadius = false): array
    {
        $department = Department::query()->create(['name' => 'Operations']);
        $location = AttendanceLocation::query()->create([
            'name' => 'EMZI HQ',
            'geofence_enabled' => true,
            'center_latitude' => $this->officeLat,
            'center_longitude' => $this->officeLng,
            'radius_meters' => 120,
            'allow_outside_radius' => $allowOutsideRadius,
            'allow_clock_out_outside_radius' => $allowOutsideRadius,
            'sites' => [[
                'name' => 'Primary',
                'latitude' => $this->officeLat,
                'longitude' => $this->officeLng,
            ]],
        ]);

        $setting = DepartmentAttendanceSetting::query()->create([
            'department_id' => $department->id,
            'attendance_location_id' => $location->id,
            'enabled' => true,
            'timezone' => 'Asia/Kuala_Lumpur',
            'grace_period_minutes' => 15,
            'allow_outside_shift_hours' => true,
            'overtime_enabled' => false,
            'standard_hours_per_day' => 8,
            'overtime_threshold_minutes' => 0,
            'shifts' => [],
        ]);

        $employee = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'department_id' => $department->id,
            'email' => 'special-release-clock@example.com',
        ]);

        return [$employee, $setting];
    }

    private function fakeApprovedRelease(User $user, string $date): void
    {
        Http::fake([
            'http://resource.test/.well-known/nexus-integration.json' => Http::response([
                'name' => 'EMZI Nexus Insan',
                'capabilities' => ['attendance.ingest', 'special_releases.covering'],
                'endpoints' => [
                    'special_releases_covering' => '/api/nexus/v1/special-releases/covering',
                ],
            ]),
            'http://resource.test/api/nexus/v1/special-releases/covering*' => Http::response([
                'date' => $date,
                'releases' => [[
                    'nexus_user_id' => (string) $user->id,
                    'id' => 99,
                    'type' => 'wfh',
                    'date' => $date,
                    'end_date' => null,
                    'center_latitude' => $this->homeLat,
                    'center_longitude' => $this->homeLng,
                    'radius_meters' => 100,
                ]],
            ]),
        ]);
    }

    private function clock(string $token, float $lat, float $lng)
    {
        return $this->withToken($token)->postJson('/api/attendance/clock', [
            'type' => 'clock_in',
            'photo_url' => 'https://example.com/selfie.jpg',
            'latitude' => $lat,
            'longitude' => $lng,
            'timezone' => 'Asia/Kuala_Lumpur',
            'captured_at' => now()->toIso8601String(),
        ]);
    }

    public function test_without_special_release_home_pin_is_blocked(): void
    {
        $this->createInsanApplication();
        [$employee] = $this->makeEmployeeWithGeofence(allowOutsideRadius: false);
        $token = ApiTokenAuth::issueToken($employee);

        Http::fake([
            'http://resource.test/.well-known/nexus-integration.json' => Http::response([
                'name' => 'EMZI Nexus Insan',
                'capabilities' => ['special_releases.covering'],
                'endpoints' => [
                    'special_releases_covering' => '/api/nexus/v1/special-releases/covering',
                ],
            ]),
            'http://resource.test/api/nexus/v1/special-releases/covering*' => Http::response([
                'date' => now('Asia/Kuala_Lumpur')->toDateString(),
                'releases' => [],
            ]),
        ]);

        $response = $this->clock($token, $this->homeLat, $this->homeLng);
        $response->assertStatus(422);
        $this->assertStringContainsString('registered site', (string) $response->json('message'));
    }

    public function test_approved_special_release_allows_clock_at_pin_on_brain(): void
    {
        $this->createInsanApplication();
        [$employee] = $this->makeEmployeeWithGeofence(allowOutsideRadius: false);
        $token = ApiTokenAuth::issueToken($employee);
        $today = now('Asia/Kuala_Lumpur')->toDateString();

        $this->fakeApprovedRelease($employee, $today);

        $response = $this->clock($token, $this->homeLat, $this->homeLng);
        $response->assertCreated();
        $this->assertSame(99, (int) data_get($response->json('metadata'), 'policy.special_release_id'));
        $this->assertSame('wfh', data_get($response->json('metadata'), 'policy.special_release_type'));
        $this->assertStringContainsString('Special release', (string) data_get($response->json('metadata'), 'policy.matched_site_name'));
    }

    public function test_status_includes_active_special_release_from_insan(): void
    {
        $this->createInsanApplication();
        [$employee] = $this->makeEmployeeWithGeofence(allowOutsideRadius: false);
        $token = ApiTokenAuth::issueToken($employee);
        $today = now('Asia/Kuala_Lumpur')->toDateString();

        $this->fakeApprovedRelease($employee, $today);

        $this->withToken($token)->getJson('/api/attendance/status')
            ->assertOk()
            ->assertJsonPath('policy.active_special_release.id', 99)
            ->assertJsonPath('policy.active_special_release.radius_meters', 100)
            ->assertJsonPath('policy.active_special_release.type', 'wfh');
    }
}
