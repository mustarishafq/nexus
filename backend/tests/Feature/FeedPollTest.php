<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\ApiTokenAuth;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FeedPollTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_create_post_with_poll_and_vote(): void
    {
        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $voter = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $authorToken = ApiTokenAuth::issueToken($author);
        $voterToken = ApiTokenAuth::issueToken($voter);

        $item = $this->withToken($authorToken)
            ->postJson('/api/posts', [
                'body' => 'Which day works best?',
                'poll' => [
                    'options' => ['Monday', 'Wednesday', 'Friday'],
                ],
            ])
            ->assertCreated()
            ->json('item');

        $this->assertNotNull($item['poll']);
        $this->assertCount(1, $item['polls']);
        $this->assertCount(3, $item['poll']['options']);
        $this->assertSame(0, $item['poll']['total_votes']);
        $this->assertFalse($item['poll']['has_voted']);
        $this->assertFalse($item['poll']['allow_multiple']);
        $this->assertFalse($item['poll']['allow_add_options']);

        $pollId = $item['poll']['id'];
        $optionId = $item['poll']['options'][1]['id'];

        $voted = $this->withToken($voterToken)
            ->postJson("/api/posts/{$item['id']}/polls/{$pollId}/vote", [
                'option_id' => $optionId,
            ])
            ->assertOk()
            ->json('item');

        $this->assertTrue($voted['poll']['has_voted']);
        $this->assertSame(1, $voted['poll']['total_votes']);
        $this->assertSame($optionId, $voted['poll']['my_option_id']);
        $this->assertTrue(collect($voted['poll']['options'])->firstWhere('id', $optionId)['voted']);
        $this->assertSame(100, collect($voted['poll']['options'])->firstWhere('id', $optionId)['percent']);

        // Toggle off by voting same option again
        $cleared = $this->withToken($voterToken)
            ->postJson("/api/posts/{$item['id']}/polls/{$pollId}/vote", [
                'option_id' => $optionId,
            ])
            ->assertOk()
            ->json('item');

        $this->assertFalse($cleared['poll']['has_voted']);
        $this->assertSame(0, $cleared['poll']['total_votes']);
    }

    public function test_user_can_create_post_with_multiple_polls(): void
    {
        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $token = ApiTokenAuth::issueToken($author);

        $item = $this->withToken($token)
            ->postJson('/api/posts', [
                'body' => 'Two quick questions',
                'polls' => [
                    ['options' => ['Yes', 'No']],
                    ['options' => ['Morning', 'Afternoon'], 'allow_multiple' => true],
                ],
            ])
            ->assertCreated()
            ->json('item');

        $this->assertCount(2, $item['polls']);
        $this->assertSame($item['polls'][0]['id'], $item['poll']['id']);
        $this->assertSame(['Yes', 'No'], collect($item['polls'][0]['options'])->pluck('label')->all());
        $this->assertTrue($item['polls'][1]['allow_multiple']);
        $this->assertSame(['Morning', 'Afternoon'], collect($item['polls'][1]['options'])->pluck('label')->all());
    }

    public function test_post_rejects_more_than_three_polls(): void
    {
        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $token = ApiTokenAuth::issueToken($author);

        $this->withToken($token)
            ->postJson('/api/posts', [
                'polls' => [
                    ['options' => ['A', 'B']],
                    ['options' => ['C', 'D']],
                    ['options' => ['E', 'F']],
                    ['options' => ['G', 'H']],
                ],
            ])
            ->assertStatus(422);
    }

    public function test_multi_select_poll_allows_multiple_votes(): void
    {
        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $voter = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $authorToken = ApiTokenAuth::issueToken($author);
        $voterToken = ApiTokenAuth::issueToken($voter);

        $item = $this->withToken($authorToken)
            ->postJson('/api/posts', [
                'body' => 'Pick all that apply',
                'poll' => [
                    'options' => ['A', 'B', 'C'],
                    'allow_multiple' => true,
                ],
            ])
            ->assertCreated()
            ->json('item');

        $this->assertTrue($item['poll']['allow_multiple']);
        $pollId = $item['poll']['id'];
        $first = $item['poll']['options'][0]['id'];
        $second = $item['poll']['options'][1]['id'];

        $this->withToken($voterToken)
            ->postJson("/api/posts/{$item['id']}/polls/{$pollId}/vote", ['option_id' => $first])
            ->assertOk();

        $voted = $this->withToken($voterToken)
            ->postJson("/api/posts/{$item['id']}/polls/{$pollId}/vote", ['option_id' => $second])
            ->assertOk()
            ->json('item');

        $this->assertEqualsCanonicalizing([$first, $second], $voted['poll']['my_option_ids']);
        $this->assertSame(1, $voted['poll']['total_votes']);
        $this->assertSame(100, collect($voted['poll']['options'])->firstWhere('id', $first)['percent']);
    }

    public function test_anyone_can_add_poll_option_when_enabled(): void
    {
        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $colleague = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $authorToken = ApiTokenAuth::issueToken($author);
        $colleagueToken = ApiTokenAuth::issueToken($colleague);

        $item = $this->withToken($authorToken)
            ->postJson('/api/posts', [
                'poll' => [
                    'options' => ['Yes', 'No'],
                    'allow_add_options' => true,
                ],
            ])
            ->assertCreated()
            ->json('item');

        $this->assertTrue($item['poll']['can_add_options']);
        $pollId = $item['poll']['id'];

        $updated = $this->withToken($colleagueToken)
            ->postJson("/api/posts/{$item['id']}/polls/{$pollId}/options", [
                'label' => 'Maybe',
            ])
            ->assertCreated()
            ->json('item');

        $this->assertCount(3, $updated['poll']['options']);
        $this->assertTrue(collect($updated['poll']['options'])->contains(
            fn (array $option) => $option['label'] === 'Maybe'
        ));
    }

    public function test_poll_only_post_is_allowed(): void
    {
        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $token = ApiTokenAuth::issueToken($author);

        $this->withToken($token)
            ->postJson('/api/posts', [
                'poll' => [
                    'options' => ['Yes', 'No'],
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('item.poll.options.0.label', 'Yes');
    }

    public function test_poll_requires_at_least_two_options(): void
    {
        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $token = ApiTokenAuth::issueToken($author);

        $this->withToken($token)
            ->postJson('/api/posts', [
                'body' => 'Bad poll',
                'poll' => [
                    'options' => ['Only one'],
                ],
            ])
            ->assertStatus(422);
    }

    public function test_author_can_update_poll_options_and_settings(): void
    {
        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $token = ApiTokenAuth::issueToken($author);

        $item = $this->withToken($token)
            ->postJson('/api/posts', [
                'body' => 'Vote please',
                'poll' => [
                    'options' => ['Yes', 'No'],
                ],
            ])
            ->assertCreated()
            ->json('item');

        $pollId = $item['poll']['id'];
        $yesId = $item['poll']['options'][0]['id'];

        $updated = $this->withToken($token)
            ->putJson("/api/posts/{$item['id']}/polls/{$pollId}", [
                'allow_multiple' => true,
                'allow_add_options' => true,
                'options' => [
                    ['id' => $yesId, 'label' => 'Absolutely'],
                    ['label' => 'Maybe'],
                    ['label' => 'No way'],
                ],
            ])
            ->assertOk()
            ->json('item');

        $this->assertTrue($updated['poll']['allow_multiple']);
        $this->assertTrue($updated['poll']['allow_add_options']);
        $this->assertCount(3, $updated['poll']['options']);
        $this->assertSame('Absolutely', $updated['poll']['options'][0]['label']);
        $this->assertSame($yesId, $updated['poll']['options'][0]['id']);
        $this->assertTrue(collect($updated['poll']['options'])->contains(
            fn (array $option) => $option['label'] === 'Maybe'
        ));
        $this->assertFalse(collect($updated['poll']['options'])->contains(
            fn (array $option) => $option['label'] === 'No'
        ));
    }

    public function test_author_can_add_and_delete_poll_on_existing_post(): void
    {
        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $token = ApiTokenAuth::issueToken($author);

        $item = $this->withToken($token)
            ->postJson('/api/posts', [
                'body' => 'Starting without a poll',
            ])
            ->assertCreated()
            ->json('item');

        $withPoll = $this->withToken($token)
            ->postJson("/api/posts/{$item['id']}/polls", [
                'options' => ['One', 'Two'],
            ])
            ->assertCreated()
            ->json('item');

        $this->assertCount(1, $withPoll['polls']);
        $pollId = $withPoll['polls'][0]['id'];

        $cleared = $this->withToken($token)
            ->deleteJson("/api/posts/{$item['id']}/polls/{$pollId}")
            ->assertOk()
            ->json('item');

        $this->assertCount(0, $cleared['polls']);
        $this->assertNull($cleared['poll']);
    }
}
