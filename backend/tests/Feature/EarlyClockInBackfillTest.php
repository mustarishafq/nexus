<?php

namespace Tests\Feature;

use App\Models\AttendanceRecord;
use App\Models\Department;
use App\Models\DepartmentAttendanceSetting;
use App\Models\ExpReward;
use App\Models\User;
use App\Models\UserStreak;
use App\Support\ApiTokenAuth;
use App\Support\AppSettings;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class EarlyClockInBackfillTest extends TestCase
{
    use RefreshDatabase;

    private function token(User $user): string
    {
        return ApiTokenAuth::issueToken($user);
    }

    /**
     * @return array{0: User, 1: AttendanceRecord}
     */
    private function seedEligibleClockIn(): array
    {
        Carbon::setTestNow(Carbon::parse('2026-09-01 10:00:00', 'Asia/Kuala_Lumpur'));

        DB::table('app_settings')->insert([
            'system_name' => 'Nexus',
            'gamification_overrides' => json_encode([
                'early_clock_in_window_minutes' => 120,
            ]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        AppSettings::forget();

        $department = Department::query()->create(['name' => 'Ops']);
        DepartmentAttendanceSetting::query()->create([
            'department_id' => $department->id,
            'enabled' => true,
            'timezone' => 'Asia/Kuala_Lumpur',
            'grace_period_minutes' => 10,
            'require_early_clock_out_reason' => false,
            'require_late_clock_in_reason' => false,
            'allow_outside_shift_hours' => true,
            'overtime_enabled' => false,
            'standard_hours_per_day' => 8,
            'overtime_threshold_minutes' => 0,
            'shifts' => [[
                'name' => 'Day Shift',
                'days_of_week' => [1, 2, 3, 4, 5],
                'start_time' => '09:00',
                'end_time' => '17:30',
                'crosses_midnight' => false,
            ]],
        ]);

        $user = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'department_id' => $department->id,
            'email' => 'ain.azman@example.com',
            'exp_total' => 0,
        ]);

        $capturedAt = Carbon::parse('2026-08-26 07:29:26', 'Asia/Kuala_Lumpur');
        $record = AttendanceRecord::query()->create([
            'user_id' => $user->id,
            'type' => 'clock_in',
            'photo_url' => 'https://example.com/in.jpg',
            'captured_at' => $capturedAt,
        ]);

        return [$user, $record];
    }

    public function test_admin_preview_does_not_create_rewards(): void
    {
        [$user, $record] = $this->seedEligibleClockIn();
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);

        $this->withToken($this->token($admin))
            ->postJson('/api/admin/gamification/early-clock-in-backfill', [
                'date' => '2026-08-26',
                'user' => (string) $user->id,
                'dry_run' => true,
            ])
            ->assertOk()
            ->assertJsonPath('dry_run', true)
            ->assertJsonPath('offered', 1)
            ->assertJsonPath('window_minutes', 120)
            ->assertJsonPath('items.0.record_id', $record->id)
            ->assertJsonPath('items.0.amount', 15)
            ->assertJsonPath('items.0.base', 15)
            ->assertJsonPath('items.0.streak_bonus', 0)
            ->assertJsonPath('items.0.streak_count', 1)
            ->assertJsonPath('items.0.streak_skipped', false)
            ->assertJsonPath('items.0.mission', 'Early clock in')
            ->assertJsonPath('items.0.action_key', 'clock_in_early');

        $this->assertSame(0, ExpReward::query()->count());
        $this->assertSame(0, (int) $user->fresh()->exp_total);

        Carbon::setTestNow();
    }

    public function test_preview_includes_already_granted_early_rewards(): void
    {
        [$user, $record] = $this->seedEligibleClockIn();
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);

        $this->withToken($this->token($admin))
            ->postJson('/api/admin/gamification/early-clock-in-backfill', [
                'date' => '2026-08-26',
                'user' => (string) $user->id,
            ])
            ->assertOk()
            ->assertJsonPath('offered', 1);

        $this->withToken($this->token($admin))
            ->postJson('/api/admin/gamification/early-clock-in-backfill', [
                'date' => '2026-08-26',
                'user' => (string) $user->id,
                'dry_run' => true,
            ])
            ->assertOk()
            ->assertJsonPath('offered', 0)
            ->assertJsonPath('already_granted', 1)
            ->assertJsonPath('items.0.record_id', $record->id)
            ->assertJsonPath('items.0.status', 'already_pending')
            ->assertJsonPath('items.0.email', $user->email);

        $this->assertSame(1, ExpReward::query()->count());

        Carbon::setTestNow();
    }

    public function test_backfill_does_not_call_special_release_http(): void
    {
        Http::preventStrayRequests();
        [$user] = $this->seedEligibleClockIn();
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);

        $this->withToken($this->token($admin))
            ->postJson('/api/admin/gamification/early-clock-in-backfill', [
                'date' => '2026-08-26',
                'user' => (string) $user->id,
                'dry_run' => true,
            ])
            ->assertOk()
            ->assertJsonPath('offered', 1);

        Carbon::setTestNow();
    }

    public function test_admin_can_offer_pending_early_clock_in(): void
    {
        [$user, $record] = $this->seedEligibleClockIn();
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);

        $this->withToken($this->token($admin))
            ->postJson('/api/admin/gamification/early-clock-in-backfill', [
                'date' => '2026-08-26',
                'user' => $user->email,
                'status' => 'pending',
            ])
            ->assertOk()
            ->assertJsonPath('dry_run', false)
            ->assertJsonPath('offered', 1)
            ->assertJsonPath('status', 'pending');

        $reward = ExpReward::query()
            ->where('user_id', $user->id)
            ->where('action_key', 'clock_in_early')
            ->where('source_id', (string) $record->id)
            ->first();

        $this->assertNotNull($reward);
        $this->assertSame(ExpReward::STATUS_PENDING, $reward->status);
        $this->assertSame(15, (int) $reward->amount);
        $this->assertSame(0, (int) $user->fresh()->exp_total);

        Carbon::setTestNow();
    }

    public function test_regular_user_cannot_backfill(): void
    {
        [$user] = $this->seedEligibleClockIn();

        $this->withToken($this->token($user))
            ->postJson('/api/admin/gamification/early-clock-in-backfill', [
                'date' => '2026-08-26',
                'user' => (string) $user->id,
            ])
            ->assertForbidden();

        $this->assertSame(0, ExpReward::query()->count());

        Carbon::setTestNow();
    }

    public function test_unknown_user_returns_validation_error(): void
    {
        $this->seedEligibleClockIn();
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);

        $this->withToken($this->token($admin))
            ->postJson('/api/admin/gamification/early-clock-in-backfill', [
                'date' => '2026-08-26',
                'user' => 'missing@example.com',
            ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'User not found: missing@example.com');

        Carbon::setTestNow();
    }

    public function test_preview_shows_consecutive_streak_bonus(): void
    {
        [$user] = $this->seedEligibleClockIn();
        AttendanceRecord::query()->create([
            'user_id' => $user->id,
            'type' => 'clock_in',
            'photo_url' => 'https://example.com/in-27.jpg',
            'captured_at' => Carbon::parse('2026-08-27 07:12:00', 'Asia/Kuala_Lumpur'),
        ]);
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);

        $this->withToken($this->token($admin))
            ->postJson('/api/admin/gamification/early-clock-in-backfill', [
                'date' => '2026-08-26',
                'date_to' => '2026-08-27',
                'user' => (string) $user->id,
                'dry_run' => true,
            ])
            ->assertOk()
            ->assertJsonPath('offered', 2)
            ->assertJsonPath('items.0.qualified_on', '2026-08-26')
            ->assertJsonPath('items.0.amount', 15)
            ->assertJsonPath('items.0.streak_count', 1)
            ->assertJsonPath('items.1.qualified_on', '2026-08-27')
            ->assertJsonPath('items.1.amount', 22)
            ->assertJsonPath('items.1.base', 15)
            ->assertJsonPath('items.1.streak_bonus', 7)
            ->assertJsonPath('items.1.streak_count', 2);

        $this->assertSame(0, ExpReward::query()->count());

        Carbon::setTestNow();
    }

    public function test_preview_skips_streak_when_later_day_already_counted(): void
    {
        [$user, $record] = $this->seedEligibleClockIn();
        UserStreak::query()->create([
            'user_id' => $user->id,
            'streak_key' => 'early_clock_in',
            'current_count' => 2,
            'longest_count' => 5,
            'last_qualified_on' => '2026-08-28',
        ]);
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);

        $this->withToken($this->token($admin))
            ->postJson('/api/admin/gamification/early-clock-in-backfill', [
                'date' => '2026-08-26',
                'user' => (string) $user->id,
                'dry_run' => true,
            ])
            ->assertOk()
            ->assertJsonPath('items.0.record_id', $record->id)
            ->assertJsonPath('items.0.amount', 15)
            ->assertJsonPath('items.0.streak_bonus', 0)
            ->assertJsonPath('items.0.streak_skipped', true)
            ->assertJsonPath('items.0.previous_streak', 2)
            ->assertJsonPath('items.0.last_qualified_on', '2026-08-28');

        Carbon::setTestNow();
    }
}
