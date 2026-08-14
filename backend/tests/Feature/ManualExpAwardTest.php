<?php

namespace Tests\Feature;

use App\Models\ExpReward;
use App\Models\User;
use App\Services\GamificationService;
use App\Support\ApiTokenAuth;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ManualExpAwardTest extends TestCase
{
    use RefreshDatabase;

    private function token(User $user): string
    {
        return ApiTokenAuth::issueToken($user);
    }

    public function test_hr_can_award_custom_pending_exp(): void
    {
        $hr = User::factory()->create(['is_approved' => true, 'role' => 'hr']);
        $recipient = User::factory()->create(['is_approved' => true, 'exp_total' => 0, 'role' => 'user']);

        $response = $this->withToken($this->token($hr))
            ->postJson('/api/admin/gamification/manual-awards', [
                'user_ids' => [$recipient->id],
                'amount' => 50,
                'title' => 'Company outing helper',
                'reason' => 'Helped at the booth',
                'notify' => false,
            ])
            ->assertOk()
            ->assertJsonPath('awarded', 1)
            ->assertJsonPath('amount', 50)
            ->assertJsonPath('title', 'Company outing helper');

        $this->assertNotEmpty($response->json('batch_id'));
        $this->assertSame(0, (int) $recipient->fresh()->exp_total);

        $reward = ExpReward::query()->where('user_id', $recipient->id)->first();
        $this->assertNotNull($reward);
        $this->assertSame(ExpReward::STATUS_PENDING, $reward->status);
        $this->assertSame(50, (int) $reward->amount);
        $this->assertSame('manual_award', $reward->action_key);
        $this->assertSame('Company outing helper', $reward->title);
        $this->assertSame($hr->id, $reward->metadata['awarded_by_id']);
    }

    public function test_admin_can_award_and_recipient_can_claim(): void
    {
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $recipient = User::factory()->create(['is_approved' => true, 'exp_total' => 0, 'role' => 'user']);

        $this->withToken($this->token($admin))
            ->postJson('/api/admin/gamification/manual-awards', [
                'user_ids' => [$recipient->id],
                'amount' => 75,
                'title' => 'Event volunteer',
                'notify' => false,
            ])
            ->assertOk();

        $reward = ExpReward::query()->where('user_id', $recipient->id)->first();
        $this->assertNotNull($reward);

        $this->withToken($this->token($recipient))
            ->postJson("/api/gamification/rewards/{$reward->id}/claim")
            ->assertOk()
            ->assertJsonPath('reward.status', 'claimed')
            ->assertJsonPath('exp_total', 75);

        $this->assertSame(75, (int) $recipient->fresh()->exp_total);
    }

    public function test_regular_user_cannot_award(): void
    {
        $user = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $recipient = User::factory()->create(['is_approved' => true, 'role' => 'user']);

        $this->withToken($this->token($user))
            ->postJson('/api/admin/gamification/manual-awards', [
                'user_ids' => [$recipient->id],
                'amount' => 10,
                'title' => 'Nope',
            ])
            ->assertForbidden();
    }

    public function test_same_user_can_receive_multiple_manual_awards(): void
    {
        $hr = User::factory()->create(['is_approved' => true, 'role' => 'hr']);
        $recipient = User::factory()->create(['is_approved' => true, 'role' => 'user']);

        $this->withToken($this->token($hr))
            ->postJson('/api/admin/gamification/manual-awards', [
                'user_ids' => [$recipient->id],
                'amount' => 20,
                'title' => 'First award',
                'notify' => false,
            ])
            ->assertOk();

        $this->withToken($this->token($hr))
            ->postJson('/api/admin/gamification/manual-awards', [
                'user_ids' => [$recipient->id],
                'amount' => 30,
                'title' => 'Second award',
                'notify' => false,
            ])
            ->assertOk();

        $this->assertSame(2, ExpReward::query()->where('user_id', $recipient->id)->count());
    }

    public function test_invalid_amount_rejected(): void
    {
        $hr = User::factory()->create(['is_approved' => true, 'role' => 'hr']);
        $recipient = User::factory()->create(['is_approved' => true, 'role' => 'user']);

        $this->withToken($this->token($hr))
            ->postJson('/api/admin/gamification/manual-awards', [
                'user_ids' => [$recipient->id],
                'amount' => 0,
                'title' => 'Bad amount',
            ])
            ->assertStatus(422);

        $this->withToken($this->token($hr))
            ->postJson('/api/admin/gamification/manual-awards', [
                'user_ids' => [$recipient->id],
                'amount' => 5001,
                'title' => 'Too much',
            ])
            ->assertStatus(422);
    }

    public function test_skips_unapproved_users(): void
    {
        $hr = User::factory()->create(['is_approved' => true, 'role' => 'hr']);
        $approved = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $pending = User::factory()->create(['is_approved' => false, 'role' => 'user']);

        $this->withToken($this->token($hr))
            ->postJson('/api/admin/gamification/manual-awards', [
                'user_ids' => [$approved->id, $pending->id],
                'amount' => 40,
                'title' => 'Helpers',
                'notify' => false,
            ])
            ->assertOk()
            ->assertJsonPath('awarded', 1)
            ->assertJsonCount(1, 'skipped');

        $this->assertSame(1, ExpReward::query()->count());
    }

    public function test_index_lists_recent_batches(): void
    {
        $hr = User::factory()->create(['is_approved' => true, 'role' => 'hr']);
        $a = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $b = User::factory()->create(['is_approved' => true, 'role' => 'user']);

        $this->withToken($this->token($hr))
            ->postJson('/api/admin/gamification/manual-awards', [
                'user_ids' => [$a->id, $b->id],
                'amount' => 15,
                'title' => 'Team lunch helpers',
                'notify' => false,
            ])
            ->assertOk();

        $response = $this->withToken($this->token($hr))
            ->getJson('/api/admin/gamification/manual-awards')
            ->assertOk()
            ->assertJsonPath('batches.0.title', 'Team lunch helpers')
            ->assertJsonPath('batches.0.amount', 15)
            ->assertJsonPath('batches.0.user_count', 2)
            ->assertJsonCount(2, 'batches.0.users');

        $emails = collect($response->json('batches.0.users'))->pluck('email')->sort()->values()->all();
        $this->assertSame(collect([$a->email, $b->email])->sort()->values()->all(), $emails);
    }

    public function test_missions_includes_manual_awards_in_completed_today(): void
    {
        $hr = User::factory()->create(['is_approved' => true, 'role' => 'hr']);
        $user = User::factory()->create(['is_approved' => true, 'role' => 'user']);

        $this->withToken($this->token($hr))
            ->postJson('/api/admin/gamification/manual-awards', [
                'user_ids' => [$user->id],
                'amount' => 42,
                'title' => 'Event helper',
                'reason' => 'Helped at booth',
                'notify' => false,
            ])
            ->assertOk();

        $payload = $this->withToken($this->token($user))
            ->getJson('/api/gamification/missions')
            ->assertOk()
            ->json();

        $manual = collect($payload['missions'])->first(
            fn (array $mission) => ($mission['is_manual_award'] ?? false) === true
        );

        $this->assertNotNull($manual);
        $this->assertSame('Event helper', $manual['title']);
        $this->assertSame(42, $manual['base']);
        $this->assertTrue($manual['completed_today']);
        $this->assertSame('pending', $manual['reward_status']);
        $this->assertStringContainsString('Helped at booth', $manual['description']);
        $this->assertStringContainsString('from', $manual['description']);
        $this->assertStringNotContainsString('Custom award', $manual['description']);
    }

    public function test_offer_manual_batch_service_shares_batch_id(): void
    {
        $hr = User::factory()->create(['is_approved' => true, 'role' => 'hr']);
        $users = User::factory()->count(3)->create(['is_approved' => true, 'role' => 'user']);

        $result = app(GamificationService::class)->offerManualBatch(
            $users->all(),
            12,
            'Batch title',
            $hr,
            'Note',
        );

        $this->assertCount(3, $result['rewards']);
        foreach ($result['rewards'] as $reward) {
            $this->assertSame($result['batch_id'], $reward->metadata['batch_id']);
            $this->assertSame(ExpReward::STATUS_PENDING, $reward->status);
        }
    }
}
