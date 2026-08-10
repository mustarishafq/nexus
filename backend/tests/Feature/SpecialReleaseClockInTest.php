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

    private function fakeApprovedRelease(User $user, string $date, array $extra = []): void
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
                    'allow_outside_radius' => false,
                    'overwrite_shift' => false,
                    'shift_start_time' => null,
                    'shift_end_time' => null,
                    'shift_crosses_midnight' => false,
                    ...$extra,
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

    public function test_special_release_allow_outside_radius_overrides_department_geofence(): void
    {
        $this->createInsanApplication();
        // Department location blocks outside radius.
        [$employee] = $this->makeEmployeeWithGeofence(allowOutsideRadius: false);
        $token = ApiTokenAuth::issueToken($employee);
        $today = now('Asia/Kuala_Lumpur')->toDateString();

        $this->fakeApprovedRelease($employee, $today, [
            'allow_outside_radius' => true,
        ]);

        // Far from the approved pin — should warn, not block.
        $farLat = $this->homeLat + 0.02;
        $farLng = $this->homeLng + 0.02;

        $this->clock($token, $farLat, $farLng)
            ->assertCreated()
            ->assertJsonPath('metadata.policy.special_release_id', 99)
            ->assertJsonPath('metadata.policy.outside_radius', true);
    }

    public function test_special_release_blocks_outside_pin_when_allow_outside_false(): void
    {
        $this->createInsanApplication();
        [$employee] = $this->makeEmployeeWithGeofence(allowOutsideRadius: true);
        $token = ApiTokenAuth::issueToken($employee);
        $today = now('Asia/Kuala_Lumpur')->toDateString();

        $this->fakeApprovedRelease($employee, $today, [
            'allow_outside_radius' => false,
        ]);

        $farLat = $this->homeLat + 0.02;
        $farLng = $this->homeLng + 0.02;

        $response = $this->clock($token, $farLat, $farLng);
        $response->assertStatus(422);
        $this->assertStringContainsString('special release pin', (string) $response->json('message'));
    }

    public function test_status_includes_active_special_release_from_insan(): void
    {
        $this->createInsanApplication();
        [$employee] = $this->makeEmployeeWithGeofence(allowOutsideRadius: false);
        $token = ApiTokenAuth::issueToken($employee);
        $today = now('Asia/Kuala_Lumpur')->toDateString();

        $this->fakeApprovedRelease($employee, $today, [
            'overwrite_shift' => true,
            'shift_start_time' => '22:00',
            'shift_end_time' => '06:00',
            'shift_crosses_midnight' => true,
        ]);

        $this->withToken($token)->getJson('/api/attendance/status')
            ->assertOk()
            ->assertJsonPath('policy.active_special_release.id', 99)
            ->assertJsonPath('policy.active_special_release.radius_meters', 100)
            ->assertJsonPath('policy.active_special_release.type', 'wfh')
            ->assertJsonPath('policy.active_special_release.overwrite_shift', true)
            ->assertJsonPath('policy.active_special_release.shift_start_time', '22:00')
            ->assertJsonPath('policy.active_special_release.shift_end_time', '06:00');
    }

    public function test_overwrite_shift_uses_custom_hours_for_late_on_brain(): void
    {
        $this->createInsanApplication();
        [$employee, $setting] = $this->makeEmployeeWithGeofence(allowOutsideRadius: false);
        $setting->update([
            'allow_outside_shift_hours' => false,
            'grace_period_minutes' => 15,
            'shifts' => [[
                'id' => 'day',
                'name' => 'Day Shift',
                'days_of_week' => [1, 2, 3, 4, 5, 6, 7],
                'start_time' => '09:00',
                'end_time' => '18:00',
                'crosses_midnight' => false,
            ]],
        ]);

        $token = ApiTokenAuth::issueToken($employee);
        $today = now('Asia/Kuala_Lumpur')->toDateString();

        $this->fakeApprovedRelease($employee, $today, [
            'overwrite_shift' => true,
            'shift_start_time' => '22:00',
            'shift_end_time' => '06:00',
            'shift_crosses_midnight' => true,
        ]);

        $insideWindow = now('Asia/Kuala_Lumpur')->setTime(22, 5)->utc()->toIso8601String();
        $this->withToken($token)->postJson('/api/attendance/clock', [
            'type' => 'clock_in',
            'photo_url' => 'https://example.com/selfie.jpg',
            'latitude' => $this->homeLat,
            'longitude' => $this->homeLng,
            'timezone' => 'Asia/Kuala_Lumpur',
            'captured_at' => $insideWindow,
        ])->assertCreated()
            ->assertJsonPath('metadata.policy.special_release_shift', true)
            ->assertJsonPath('metadata.policy.is_late', false)
            ->assertJsonPath('metadata.policy.shift_name', 'Special release (WFH)');

        $this->withToken($token)->postJson('/api/attendance/clock', [
            'type' => 'clock_out',
            'photo_url' => 'https://example.com/selfie-out.jpg',
            'latitude' => $this->homeLat,
            'longitude' => $this->homeLng,
            'timezone' => 'Asia/Kuala_Lumpur',
            'captured_at' => now('Asia/Kuala_Lumpur')->setTime(22, 30)->utc()->toIso8601String(),
        ])->assertCreated();

        // Daytime punch while overnight overwrite is active should be blocked.
        $outsideWindow = now('Asia/Kuala_Lumpur')->setTime(12, 0)->utc()->toIso8601String();
        $this->withToken($token)->postJson('/api/attendance/clock', [
            'type' => 'clock_in',
            'photo_url' => 'https://example.com/selfie-2.jpg',
            'latitude' => $this->homeLat,
            'longitude' => $this->homeLng,
            'timezone' => 'Asia/Kuala_Lumpur',
            'captured_at' => $outsideWindow,
        ])->assertStatus(422)
            ->assertJsonPath('message', 'Clock in/out is not allowed outside your special release shift hours.');

        // Late against overwrite start (after grace) still counts as late, not day-shift late.
        $latePunch = now('Asia/Kuala_Lumpur')->setTime(22, 40)->utc()->toIso8601String();
        $this->withToken($token)->postJson('/api/attendance/clock', [
            'type' => 'clock_in',
            'photo_url' => 'https://example.com/selfie-late.jpg',
            'latitude' => $this->homeLat,
            'longitude' => $this->homeLng,
            'timezone' => 'Asia/Kuala_Lumpur',
            'captured_at' => $latePunch,
        ])->assertCreated()
            ->assertJsonPath('metadata.policy.special_release_shift', true)
            ->assertJsonPath('metadata.policy.is_late', true)
            ->assertJsonPath('metadata.policy.shift_name', 'Special release (WFH)');
    }
}
