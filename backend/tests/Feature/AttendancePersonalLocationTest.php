<?php

namespace Tests\Feature;

use App\Models\AttendanceLocation;
use App\Models\Department;
use App\Models\DepartmentAttendanceSetting;
use App\Models\User;
use App\Support\ApiTokenAuth;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AttendancePersonalLocationTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_location_index_omits_personal_sites(): void
    {
        $token = $this->adminToken();
        $owner = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'email' => 'afiq@example.com',
            'full_name' => 'Afiq Azri Bin Wahab',
        ]);
        $shared = $this->location('EMZI HQ');
        $personal = $this->location('Afiq Azri Bin Wahab Home', $owner->id);

        $response = $this->withToken($token)->getJson('/api/admin/attendance-locations');

        $response->assertOk();
        $ids = collect($response->json('locations'))->pluck('id')->all();
        $this->assertContains($shared->id, $ids);
        $this->assertNotContains($personal->id, $ids);
    }

    public function test_admin_create_forces_shared_and_update_preserves_owner(): void
    {
        $token = $this->adminToken();
        $owner = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'email' => 'owner@example.com',
        ]);
        $personal = $this->location('Owner Home', $owner->id);

        $created = $this->withToken($token)->postJson('/api/admin/attendance-locations', [
            'name' => 'New campus',
            'owner_user_id' => $owner->id,
            'geofence_enabled' => false,
            'radius_meters' => 200,
        ])->assertCreated();

        $this->assertNull($created->json('location.owner_user_id'));
        $this->assertDatabaseHas('attendance_locations', [
            'name' => 'New campus',
            'owner_user_id' => null,
        ]);

        $this->withToken($token)->putJson('/api/admin/attendance-locations/'.$personal->id, [
            'name' => 'Owner Home',
            'geofence_enabled' => true,
            'center_latitude' => 5.6269959,
            'center_longitude' => 100.5626922,
            'radius_meters' => 150,
            'sites' => [[
                'name' => 'Home',
                'latitude' => 5.6269959,
                'longitude' => 100.5626922,
            ]],
        ])->assertOk();

        $this->assertSame($owner->id, (int) $personal->fresh()->owner_user_id);
    }

    public function test_department_policy_cannot_use_personal_location_as_default(): void
    {
        $token = $this->adminToken();
        $department = Department::query()->create(['name' => 'Operations']);
        $owner = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'department_id' => $department->id,
        ]);
        $shared = $this->location('EMZI HQ');
        $personal = $this->location('Owner Home', $owner->id);

        $this->withToken($token)->putJson('/api/admin/department-attendance/'.$department->id, [
            'enabled' => true,
            'attendance_location_id' => $personal->id,
            'timezone' => 'Asia/Kuala_Lumpur',
            'grace_period_minutes' => 15,
            'shifts' => [[
                'name' => 'Day',
                'days_of_week' => [1, 2, 3, 4, 5],
                'start_time' => '09:00',
                'end_time' => '18:00',
                'crosses_midnight' => false,
                'attendance_location_id' => $personal->id,
            ]],
        ])->assertOk()
            ->assertJsonPath('settings.attendance_location_id', null)
            ->assertJsonPath('settings.shifts.0.attendance_location_id', null);

        $this->withToken($token)->putJson('/api/admin/department-attendance/'.$department->id, [
            'enabled' => true,
            'attendance_location_id' => $shared->id,
            'timezone' => 'Asia/Kuala_Lumpur',
            'grace_period_minutes' => 15,
        ])->assertOk()
            ->assertJsonPath('settings.attendance_location_id', $shared->id);
    }

    public function test_policy_export_uses_portable_owner_keys(): void
    {
        $owner = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'email' => 'afiq@example.com',
            'full_name' => 'Afiq Azri Bin Wahab',
        ]);
        $this->location('Afiq Azri Bin Wahab Home', $owner->id);

        $snapshot = app(\App\Services\AttendancePolicySnapshotService::class)->export(false);
        $personal = collect($snapshot['locations'])->firstWhere('name', 'Afiq Azri Bin Wahab Home');

        $this->assertNotNull($personal);
        $this->assertSame('afiq@example.com', $personal['owner_email']);
        $this->assertSame((string) $owner->id, $personal['owner_nexus_user_id']);
        $this->assertArrayNotHasKey('owner_user_id', $personal);
    }

    public function test_policy_ingest_does_not_bind_personal_location_as_department_default(): void
    {
        $owner = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'email' => 'afiq@example.com',
        ]);
        $this->location('Afiq Azri Bin Wahab Home', $owner->id);
        Department::query()->create(['name' => 'Operations']);

        $stats = app(\App\Services\AttendancePolicySnapshotService::class)->apply([
            'locations' => [[
                'name' => 'Afiq Azri Bin Wahab Home',
                'owner_email' => 'afiq@example.com',
                'owner_nexus_user_id' => (string) $owner->id,
                'geofence_enabled' => true,
                'center_latitude' => 5.6269959,
                'center_longitude' => 100.5626922,
                'radius_meters' => 100,
                'sites' => [[
                    'name' => 'Home',
                    'latitude' => 5.6269959,
                    'longitude' => 100.5626922,
                ]],
            ]],
            'departments' => [[
                'department_name' => 'Operations',
                'enabled' => true,
                'location_name' => 'Afiq Azri Bin Wahab Home',
            ]],
            'prune_missing' => false,
        ]);

        $this->assertSame(1, $stats['departments_upserted']);
        $setting = DepartmentAttendanceSetting::query()->first();
        $this->assertNotNull($setting);
        $this->assertNull($setting->attendance_location_id);
        $this->assertDatabaseHas('attendance_locations', [
            'name' => 'Afiq Azri Bin Wahab Home',
            'owner_user_id' => $owner->id,
        ]);
    }

    private function adminToken(): string
    {
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);

        return ApiTokenAuth::issueToken($admin);
    }

    private function location(string $name, ?int $ownerId = null): AttendanceLocation
    {
        return AttendanceLocation::query()->create([
            'name' => $name,
            'owner_user_id' => $ownerId,
            'geofence_enabled' => true,
            'center_latitude' => 5.6269959,
            'center_longitude' => 100.5626922,
            'radius_meters' => 100,
            'allow_outside_radius' => false,
            'allow_clock_out_outside_radius' => false,
            'sites' => [[
                'name' => 'Home',
                'latitude' => 5.6269959,
                'longitude' => 100.5626922,
            ]],
        ]);
    }
}
