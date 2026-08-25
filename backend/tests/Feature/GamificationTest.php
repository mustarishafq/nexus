<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\DepartmentAttendanceSetting;
use App\Models\ExpReward;
use App\Models\Post;
use App\Models\User;
use App\Models\UserStreak;
use App\Services\GamificationService;
use App\Support\ApiTokenAuth;
use App\Support\AppSettings;
use App\Support\GamificationCatalog;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class GamificationTest extends TestCase
{
    use RefreshDatabase;

    private function token(User $user): string
    {
        return ApiTokenAuth::issueToken($user);
    }

    public function test_offer_and_claim_increments_exp_total(): void
    {
        $user = User::factory()->create(['is_approved' => true, 'exp_total' => 0]);
        $service = app(GamificationService::class);

        $reward = $service->offer($user, 'event_check_in', 'calendar_event', 101);
        $this->assertNotNull($reward);
        $this->assertSame(ExpReward::STATUS_PENDING, $reward->status);
        $this->assertSame(0, (int) $user->fresh()->exp_total);

        $this->withToken($this->token($user))
            ->postJson("/api/gamification/rewards/{$reward->id}/claim")
            ->assertOk()
            ->assertJsonPath('reward.status', 'claimed')
            ->assertJsonPath('exp_total', 25)
            ->assertJsonPath('level', 1)
            ->assertJsonPath('leveled_up', false);

        $this->assertSame(25, (int) $user->fresh()->exp_total);

        $this->withToken($this->token($user))
            ->postJson("/api/gamification/rewards/{$reward->id}/claim")
            ->assertStatus(422);
    }

    public function test_dedupe_same_source_does_not_offer_twice(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $service = app(GamificationService::class);

        $first = $service->offer($user, 'feed_comment', 'post_comment', 55);
        $second = $service->offer($user, 'feed_comment', 'post_comment', 55);

        $this->assertNotNull($first);
        $this->assertNull($second);
        $this->assertSame(1, ExpReward::query()->where('user_id', $user->id)->count());
    }

    public function test_daily_cap_blocks_further_offers(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $service = app(GamificationService::class);

        $this->assertNotNull($service->offer($user, 'clock_in', 'attendance_record', 1));
        $this->assertNull($service->offer($user, 'clock_in', 'attendance_record', 2));
    }

    public function test_early_clock_in_offers_bonus_and_increments_streak(): void
    {
        $department = Department::query()->create(['name' => 'Ops']);
        DepartmentAttendanceSetting::query()->create([
            'department_id' => $department->id,
            'enabled' => true,
            'timezone' => 'Asia/Kuala_Lumpur',
            'grace_period_minutes' => 15,
            'require_early_clock_out_reason' => false,
            'require_late_clock_in_reason' => false,
            'allow_outside_shift_hours' => true,
            'overtime_enabled' => false,
            'standard_hours_per_day' => 8,
            'overtime_threshold_minutes' => 0,
            'shifts' => [[
                'name' => 'Day Shift',
                'days_of_week' => [1, 2, 3, 4, 5, 6, 7],
                'start_time' => '09:00',
                'end_time' => '18:00',
                'crosses_midnight' => false,
            ]],
        ]);

        $user = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'department_id' => $department->id,
        ]);

        $inAt = Carbon::parse('2026-07-29 08:30:00', 'Asia/Kuala_Lumpur');

        $response = $this->withToken($this->token($user))
            ->postJson('/api/attendance/clock', [
                'type' => 'clock_in',
                'photo_url' => 'https://example.com/in.jpg',
                'captured_at' => $inAt->toIso8601String(),
                'timezone' => 'Asia/Kuala_Lumpur',
            ])
            ->assertCreated();

        $this->assertNotNull($response->json('gamification_offer'));
        $this->assertNotNull($response->json('gamification_offers'));
        $this->assertCount(2, $response->json('gamification_offers'));

        $actionKeys = collect($response->json('gamification_offers'))->pluck('action_key')->all();
        $this->assertContains('clock_in', $actionKeys);
        $this->assertContains('clock_in_early', $actionKeys);

        $streak = UserStreak::query()
            ->where('user_id', $user->id)
            ->where('streak_key', 'early_clock_in')
            ->first();

        $this->assertNotNull($streak);
        $this->assertSame(1, (int) $streak->current_count);
    }

    public function test_clock_in_before_early_window_does_not_offer_early_bonus(): void
    {
        DB::table('app_settings')->insert([
            'system_name' => 'Nexus',
            'gamification_overrides' => json_encode([
                'early_clock_in_window_minutes' => 30,
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
            'grace_period_minutes' => 15,
            'require_early_clock_out_reason' => false,
            'require_late_clock_in_reason' => false,
            'allow_outside_shift_hours' => true,
            'overtime_enabled' => false,
            'standard_hours_per_day' => 8,
            'overtime_threshold_minutes' => 0,
            'shifts' => [[
                'name' => 'Day Shift',
                'days_of_week' => [1, 2, 3, 4, 5, 6, 7],
                'start_time' => '09:00',
                'end_time' => '18:00',
                'crosses_midnight' => false,
            ]],
        ]);

        $user = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'department_id' => $department->id,
        ]);

        // 30-min early window → eligible from 08:30; 08:20 is too early.
        $inAt = Carbon::parse('2026-07-29 08:20:00', 'Asia/Kuala_Lumpur');

        $response = $this->withToken($this->token($user))
            ->postJson('/api/attendance/clock', [
                'type' => 'clock_in',
                'photo_url' => 'https://example.com/in.jpg',
                'captured_at' => $inAt->toIso8601String(),
                'timezone' => 'Asia/Kuala_Lumpur',
            ])
            ->assertCreated();

        $offers = $response->json('gamification_offers') ?? [$response->json('gamification_offer')];
        $actionKeys = collect($offers)->filter()->pluck('action_key')->all();
        $this->assertContains('clock_in', $actionKeys);
        $this->assertNotContains('clock_in_early', $actionKeys);
        $this->assertSame(0, UserStreak::query()->where('user_id', $user->id)->count());
    }

    public function test_early_clock_in_cutoff_stops_offer_before_shift(): void
    {
        DB::table('app_settings')->insert([
            'system_name' => 'Nexus',
            'gamification_overrides' => json_encode([
                'early_clock_in_window_minutes' => 60,
                'early_clock_in_cutoff_minutes' => 10,
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
            'grace_period_minutes' => 15,
            'require_early_clock_out_reason' => false,
            'require_late_clock_in_reason' => false,
            'allow_outside_shift_hours' => true,
            'overtime_enabled' => false,
            'standard_hours_per_day' => 8,
            'overtime_threshold_minutes' => 0,
            'shifts' => [[
                'name' => 'Day Shift',
                'days_of_week' => [1, 2, 3, 4, 5, 6, 7],
                'start_time' => '09:00',
                'end_time' => '18:00',
                'crosses_midnight' => false,
            ]],
        ]);

        $user = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'department_id' => $department->id,
        ]);

        // Cutoff 10 → eligible until 08:50; 08:55 is too close to start.
        $inAt = Carbon::parse('2026-07-29 08:55:00', 'Asia/Kuala_Lumpur');

        $response = $this->withToken($this->token($user))
            ->postJson('/api/attendance/clock', [
                'type' => 'clock_in',
                'photo_url' => 'https://example.com/in.jpg',
                'captured_at' => $inAt->toIso8601String(),
                'timezone' => 'Asia/Kuala_Lumpur',
            ])
            ->assertCreated();

        $offers = $response->json('gamification_offers') ?? [$response->json('gamification_offer')];
        $actionKeys = collect($offers)->filter()->pluck('action_key')->all();
        $this->assertContains('clock_in', $actionKeys);
        $this->assertNotContains('clock_in_early', $actionKeys);

        // Still within cutoff at 08:50.
        $user2 = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'department_id' => $department->id,
            'email' => 'early-cutoff-ok@example.com',
        ]);
        $okAt = Carbon::parse('2026-07-29 08:50:00', 'Asia/Kuala_Lumpur');
        $okResponse = $this->withToken($this->token($user2))
            ->postJson('/api/attendance/clock', [
                'type' => 'clock_in',
                'photo_url' => 'https://example.com/in2.jpg',
                'captured_at' => $okAt->toIso8601String(),
                'timezone' => 'Asia/Kuala_Lumpur',
            ])
            ->assertCreated();

        $okKeys = collect($okResponse->json('gamification_offers'))->pluck('action_key')->all();
        $this->assertContains('clock_in_early', $okKeys);
    }

    public function test_late_clock_in_does_not_offer_early_bonus(): void
    {
        $department = Department::query()->create(['name' => 'Ops']);
        DepartmentAttendanceSetting::query()->create([
            'department_id' => $department->id,
            'enabled' => true,
            'timezone' => 'Asia/Kuala_Lumpur',
            'grace_period_minutes' => 15,
            'require_early_clock_out_reason' => false,
            'require_late_clock_in_reason' => false,
            'allow_outside_shift_hours' => true,
            'overtime_enabled' => false,
            'standard_hours_per_day' => 8,
            'overtime_threshold_minutes' => 0,
            'shifts' => [[
                'name' => 'Day Shift',
                'days_of_week' => [1, 2, 3, 4, 5, 6, 7],
                'start_time' => '09:00',
                'end_time' => '18:00',
                'crosses_midnight' => false,
            ]],
        ]);

        $user = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'department_id' => $department->id,
        ]);

        $inAt = Carbon::parse('2026-07-29 09:45:00', 'Asia/Kuala_Lumpur');

        $response = $this->withToken($this->token($user))
            ->postJson('/api/attendance/clock', [
                'type' => 'clock_in',
                'photo_url' => 'https://example.com/in.jpg',
                'captured_at' => $inAt->toIso8601String(),
                'timezone' => 'Asia/Kuala_Lumpur',
            ])
            ->assertCreated();

        $offers = $response->json('gamification_offers') ?? [$response->json('gamification_offer')];
        $actionKeys = collect($offers)->filter()->pluck('action_key')->all();
        $this->assertContains('clock_in', $actionKeys);
        $this->assertNotContains('clock_in_early', $actionKeys);
        $this->assertSame(0, UserStreak::query()->where('user_id', $user->id)->count());
    }

    public function test_moderated_post_offers_exp_only_on_approve(): void
    {
        $settings = DB::table('app_settings')->first();
        $payload = [
            'feed_posts_require_approval' => true,
            'feed_post_approval_exempt_user_ids' => json_encode([]),
            'updated_at' => now(),
        ];

        if ($settings) {
            DB::table('app_settings')->where('id', $settings->id)->update($payload);
        } else {
            DB::table('app_settings')->insert(array_merge([
                'system_name' => 'EMZI Nexus Brain',
                'created_at' => now(),
            ], $payload));
        }

        AppSettings::forget();

        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);

        $create = $this->withToken($this->token($author))
            ->postJson('/api/posts', ['body' => 'Needs review'])
            ->assertCreated();

        $this->assertNull($create->json('gamification_offer'));
        $this->assertSame(0, ExpReward::query()->where('user_id', $author->id)->count());

        $postId = $create->json('item.id');

        $this->withToken($this->token($admin))
            ->postJson("/api/posts/{$postId}/approve")
            ->assertOk()
            ->assertJsonMissingPath('gamification_offer');

        $this->assertSame(1, ExpReward::query()->where('user_id', $author->id)->where('action_key', 'feed_post')->count());
    }

    public function test_feed_post_streak_increments_on_consecutive_days(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $service = app(GamificationService::class);

        Carbon::setTestNow(Carbon::parse('2026-08-01 10:00:00', config('app.timezone')));
        $day1 = $service->offer($user, 'feed_post', 'post', 1);
        $this->assertSame(1, (int) data_get($day1->metadata, 'streak_count'));

        Carbon::setTestNow(Carbon::parse('2026-08-02 10:00:00', config('app.timezone')));
        $day2 = $service->offer($user, 'feed_post', 'post', 2);
        $this->assertSame(2, (int) data_get($day2->metadata, 'streak_count'));
        $this->assertGreaterThan(20, (int) $day2->amount);

        Carbon::setTestNow();
    }

    public function test_leaderboard_orders_by_exp_total_and_period(): void
    {
        $low = User::factory()->create(['is_approved' => true, 'exp_total' => 10, 'name' => 'Low']);
        $high = User::factory()->create(['is_approved' => true, 'exp_total' => 50, 'name' => 'High']);
        $viewer = User::factory()->create(['is_approved' => true, 'exp_total' => 0]);

        ExpReward::query()->create([
            'user_id' => $low->id,
            'action_key' => 'event_check_in',
            'amount' => 10,
            'title' => 'Event check-in',
            'status' => ExpReward::STATUS_CLAIMED,
            'source_type' => 'calendar_event',
            'source_id' => '1',
            'claimed_at' => now()->subDays(2),
        ]);

        ExpReward::query()->create([
            'user_id' => $high->id,
            'action_key' => 'event_check_in',
            'amount' => 5,
            'title' => 'Event check-in',
            'status' => ExpReward::STATUS_CLAIMED,
            'source_type' => 'calendar_event',
            'source_id' => '2',
            'claimed_at' => now()->subDays(2),
        ]);

        ExpReward::query()->create([
            'user_id' => $high->id,
            'action_key' => 'feed_post',
            'amount' => 45,
            'title' => 'Feed post',
            'status' => ExpReward::STATUS_CLAIMED,
            'source_type' => 'post',
            'source_id' => '3',
            'claimed_at' => now()->subDays(40),
        ]);

        $all = $this->withToken($this->token($viewer))
            ->getJson('/api/gamification/leaderboard?period=all')
            ->assertOk()
            ->json('entries');

        $this->assertSame($high->id, $all[0]['user_id']);
        $this->assertSame(50, $all[0]['exp']);
        $this->assertSame($low->id, $all[1]['user_id']);

        $week = $this->withToken($this->token($viewer))
            ->getJson('/api/gamification/leaderboard?period=week')
            ->assertOk()
            ->json('entries');

        $this->assertSame($low->id, $week[0]['user_id']);
        $this->assertSame(10, $week[0]['exp']);
        $this->assertSame($high->id, $week[1]['user_id']);
        $this->assertSame(5, $week[1]['exp']);
    }

    public function test_claim_all_claims_pending_rewards(): void
    {
        $user = User::factory()->create(['is_approved' => true, 'exp_total' => 0]);
        $service = app(GamificationService::class);
        $service->offer($user, 'event_check_in', 'calendar_event', 1);
        $service->offer($user, 'celebration_wish', 'celebration_wish', 2);

        $this->withToken($this->token($user))
            ->postJson('/api/gamification/rewards/claim-all')
            ->assertOk()
            ->assertJsonPath('claimed_count', 2)
            ->assertJsonPath('claimed_amount', 35)
            ->assertJsonPath('exp_total', 35);

        $this->assertSame(0, ExpReward::query()->where('user_id', $user->id)->where('status', 'pending')->count());
    }

    public function test_missions_endpoint_lists_catalog_and_progress(): void
    {
        $user = User::factory()->create(['is_approved' => true, 'exp_total' => 0]);
        app(GamificationService::class)->offer($user, 'clock_in', 'attendance_record', 99);

        $payload = $this->withToken($this->token($user))
            ->getJson('/api/gamification/missions')
            ->assertOk()
            ->json();

        $this->assertNotEmpty($payload['missions']);
        $this->assertSame(1, $payload['pending_count']);
        $this->assertSame(1, $payload['level']);
        $this->assertSame(0, $payload['exp_into_level']);
        $this->assertSame(100, $payload['exp_for_level']);
        $this->assertSame(0, $payload['progress']);
        $this->assertSame(0, $payload['stars']);

        $clockIn = collect($payload['missions'])->firstWhere('action_key', 'clock_in');
        $this->assertNotNull($clockIn);
        $this->assertSame(1, $clockIn['offered_today']);
        $this->assertTrue($clockIn['completed_today']);
        $this->assertSame('/attendance', $clockIn['href']);
    }

    public function test_level_progress_boundaries_and_claim_level_up(): void
    {
        $catalog = \App\Support\GamificationCatalog::class;

        $this->assertSame(1, $catalog::levelProgress(0)['level']);
        $this->assertSame(0, $catalog::levelProgress(0)['stars']);
        $this->assertSame(1, $catalog::levelProgress(99)['level']);
        $this->assertSame(99, $catalog::levelProgress(99)['exp_into_level']);
        $this->assertSame(2, $catalog::levelProgress(100)['level']);
        $this->assertSame(0, $catalog::levelProgress(100)['exp_into_level']);

        // Flat through level 10, then quadratic (11 * L).
        $this->assertSame(900, $catalog::totalExpToReach(10));
        $this->assertSame(10, $catalog::levelProgress(900)['level']);
        $this->assertSame(110, $catalog::expToAdvanceFrom(10));
        $this->assertSame(11, $catalog::levelProgress(1010)['level']);
        $this->assertSame(0, $catalog::levelProgress(1010)['exp_into_level']);
        $this->assertSame(54855, $catalog::totalExpToReach(100));
        $this->assertSame(100, $catalog::levelProgress(54855)['level']);
        $this->assertSame(1, $catalog::levelProgress(54855)['stars']);
        $this->assertSame(2, $catalog::starsFromLevel(200));

        $user = User::factory()->create(['is_approved' => true, 'exp_total' => 90]);
        $service = app(GamificationService::class);
        $reward = $service->offer($user, 'event_check_in', 'calendar_event', 202);
        $this->assertNotNull($reward);

        $this->withToken($this->token($user))
            ->postJson("/api/gamification/rewards/{$reward->id}/claim")
            ->assertOk()
            ->assertJsonPath('exp_total', 115)
            ->assertJsonPath('level', 2)
            ->assertJsonPath('previous_level', 1)
            ->assertJsonPath('leveled_up', true)
            ->assertJsonPath('star_earned', false)
            ->assertJsonPath('stars', 0)
            ->assertJsonPath('exp_into_level', 15);

        $me = $this->withToken($this->token($user))
            ->getJson('/api/gamification/me')
            ->assertOk()
            ->json();

        $this->assertSame(2, $me['level']);
        $this->assertSame(15, $me['exp_into_level']);
        $this->assertSame(100, $me['exp_for_level']);
        $this->assertSame(0, $me['stars']);
    }

    public function test_claim_crossing_level_100_earns_a_star(): void
    {
        // totalExpToReach(100) = 54855; event_check_in awards 25.
        $user = User::factory()->create(['is_approved' => true, 'exp_total' => 54830]);
        $service = app(GamificationService::class);
        $reward = $service->offer($user, 'event_check_in', 'calendar_event', 303);
        $this->assertNotNull($reward);

        $before = \App\Support\GamificationCatalog::levelProgress(54830);
        $this->assertSame(99, $before['level']);
        $this->assertSame(0, $before['stars']);

        $this->withToken($this->token($user))
            ->postJson("/api/gamification/rewards/{$reward->id}/claim")
            ->assertOk()
            ->assertJsonPath('exp_total', 54855)
            ->assertJsonPath('level', 100)
            ->assertJsonPath('previous_level', 99)
            ->assertJsonPath('leveled_up', true)
            ->assertJsonPath('stars', 1)
            ->assertJsonPath('previous_stars', 0)
            ->assertJsonPath('star_earned', true);
    }

    public function test_self_reaction_does_not_offer_exp(): void
    {
        $author = User::factory()->create(['is_approved' => true]);
        $post = Post::query()->create([
            'author_user_id' => $author->id,
            'body' => 'Hello',
            'approval_status' => Post::APPROVAL_APPROVED,
            'approved_by_user_id' => $author->id,
            'approved_at' => now(),
        ]);

        $this->withToken($this->token($author))
            ->postJson("/api/posts/{$post->id}/reactions", ['reaction' => '👍'])
            ->assertOk()
            ->assertJsonMissingPath('gamification_offer');

        $this->assertSame(0, ExpReward::query()->where('user_id', $author->id)->count());
    }

    public function test_missions_includes_rival_and_week_spotlight(): void
    {
        $leader = User::factory()->create(['is_approved' => true, 'exp_total' => 200, 'name' => 'Leader']);
        $viewer = User::factory()->create(['is_approved' => true, 'exp_total' => 50, 'name' => 'Viewer']);

        ExpReward::query()->create([
            'user_id' => $viewer->id,
            'action_key' => 'event_check_in',
            'amount' => 15,
            'title' => 'Event check-in',
            'status' => ExpReward::STATUS_CLAIMED,
            'source_type' => 'calendar_event',
            'source_id' => '1',
            'claimed_at' => now()->subDay(),
        ]);

        $payload = $this->withToken($this->token($viewer))
            ->getJson('/api/gamification/missions')
            ->assertOk()
            ->json();

        $this->assertNotNull($payload['rival']);
        $this->assertSame($leader->id, $payload['rival']['user_id']);
        $this->assertSame(150, $payload['rival']['exp_ahead']);
        $this->assertSame('week', $payload['week_spotlight']['period']);
        $this->assertArrayHasKey('podium', $payload['week_spotlight']);
        $this->assertArrayHasKey('achievements', $payload);
        $this->assertNotEmpty($payload['achievements']['catalog']);
        $catalogKeys = collect($payload['achievements']['catalog'])->pluck('badge_key')->all();
        $this->assertContains('level_25', $catalogKeys);
        $this->assertContains('level_50', $catalogKeys);
        $this->assertContains('level_100', $catalogKeys);
        $this->assertContains('level_250', $catalogKeys);
        $this->assertContains('commenter_25', $catalogKeys);
        $this->assertContains('clock_in_30', $catalogKeys);
        $this->assertContains('event_5', $catalogKeys);
        $this->assertContains('quiz_5', $catalogKeys);
    }

    public function test_first_claim_unlocks_badge(): void
    {
        $user = User::factory()->create(['is_approved' => true, 'exp_total' => 0]);
        $reward = app(GamificationService::class)->offer($user, 'event_check_in', 'calendar_event', 303);
        $this->assertNotNull($reward);

        $response = $this->withToken($this->token($user))
            ->postJson("/api/gamification/rewards/{$reward->id}/claim")
            ->assertOk()
            ->json();

        $badgeKeys = collect($response['new_badges'] ?? [])->pluck('badge_key')->all();
        $this->assertContains('first_claim', $badgeKeys);
        $this->assertDatabaseHas('user_achievements', [
            'user_id' => $user->id,
            'badge_key' => 'first_claim',
        ]);
    }

    public function test_claim_unlocks_level_25_badge(): void
    {
        $user = User::factory()->create([
            'is_approved' => true,
            'exp_total' => GamificationCatalog::totalExpToReach(25),
        ]);
        $reward = app(GamificationService::class)->offer($user, 'event_check_in', 'calendar_event', 505);
        $this->assertNotNull($reward);

        $response = $this->withToken($this->token($user))
            ->postJson("/api/gamification/rewards/{$reward->id}/claim")
            ->assertOk()
            ->json();

        $badgeKeys = collect($response['new_badges'] ?? [])->pluck('badge_key')->all();
        $this->assertContains('level_5', $badgeKeys);
        $this->assertContains('level_10', $badgeKeys);
        $this->assertContains('level_25', $badgeKeys);
        $this->assertDatabaseHas('user_achievements', [
            'user_id' => $user->id,
            'badge_key' => 'level_25',
        ]);
    }

    public function test_claim_unlocks_commenter_25_badge(): void
    {
        $user = User::factory()->create(['is_approved' => true, 'exp_total' => 0]);
        $past = now()->subDays(2);

        for ($i = 1; $i <= 24; $i++) {
            ExpReward::query()->create([
                'user_id' => $user->id,
                'action_key' => 'feed_comment',
                'amount' => 8,
                'title' => 'Feed comment',
                'status' => ExpReward::STATUS_CLAIMED,
                'source_type' => 'post_comment',
                'source_id' => (string) $i,
                'claimed_at' => $past,
            ]);
        }

        ExpReward::query()
            ->where('user_id', $user->id)
            ->where('action_key', 'feed_comment')
            ->update([
                'created_at' => $past,
                'updated_at' => $past,
            ]);

        $reward = app(GamificationService::class)->offer($user, 'feed_comment', 'post_comment', 25);
        $this->assertNotNull($reward);

        $response = $this->withToken($this->token($user))
            ->postJson("/api/gamification/rewards/{$reward->id}/claim")
            ->assertOk()
            ->json();

        $badgeKeys = collect($response['new_badges'] ?? [])->pluck('badge_key')->all();
        $this->assertContains('commenter_25', $badgeKeys);
        $this->assertDatabaseHas('user_achievements', [
            'user_id' => $user->id,
            'badge_key' => 'commenter_25',
        ]);
    }

    public function test_admin_override_changes_offer_amount(): void
    {
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        DB::table('app_settings')->insert([
            'system_name' => 'Nexus',
            'gamification_overrides' => json_encode([
                'actions' => ['event_check_in' => ['base' => 40]],
            ]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        AppSettings::forget();

        $user = User::factory()->create(['is_approved' => true]);
        $reward = app(GamificationService::class)->offer($user, 'event_check_in', 'calendar_event', 404);
        $this->assertNotNull($reward);
        $this->assertSame(40, (int) $reward->amount);

        $this->withToken($this->token($admin))
            ->getJson('/api/admin/app-settings')
            ->assertOk()
            ->assertJsonPath('gamification_overrides.actions.event_check_in.base', 40)
            ->assertJsonPath('gamification.early_clock_in_window_minutes', 60)
            ->assertJsonPath('gamification.default_early_clock_in_window_minutes', 60)
            ->assertJsonPath('gamification_overrides.early_clock_in_window_minutes', 60)
            ->assertJsonPath('gamification.early_clock_in_cutoff_minutes', 0)
            ->assertJsonPath('gamification.default_early_clock_in_cutoff_minutes', 0)
            ->assertJsonPath('gamification_overrides.early_clock_in_cutoff_minutes', 0);
    }

    public function test_public_profile_includes_level_and_rank(): void
    {
        $viewer = User::factory()->create(['is_approved' => true, 'exp_total' => 10]);
        $target = User::factory()->create(['is_approved' => true, 'exp_total' => 250]);

        $this->withToken($this->token($viewer))
            ->getJson("/api/users/{$target->id}/profile")
            ->assertOk()
            ->assertJsonPath('user.exp_total', 250)
            ->assertJsonPath('user.level', 3)
            ->assertJsonPath('user.rank', 1);
    }
}
