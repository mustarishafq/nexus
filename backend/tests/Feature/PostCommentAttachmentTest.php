<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use App\Support\ApiTokenAuth;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PostCommentAttachmentTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private string $token;

    private Post $post;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');
        $this->user = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $this->token = ApiTokenAuth::issueToken($this->user);
        $this->post = Post::query()->create([
            'author_user_id' => User::factory()->create(['is_approved' => true, 'role' => 'user'])->id,
            'body' => 'Hello team',
            'approval_status' => Post::APPROVAL_APPROVED,
        ]);
    }

    private function uploadCommentImage(): string
    {
        return $this->withToken($this->token)
            ->post('/api/uploads', [
                'folder' => 'comment-images',
                'file' => UploadedFile::fake()->image('photo.jpg', 640, 480),
            ])
            ->assertCreated()
            ->json('file_url');
    }

    public function test_photo_only_comment_is_saved_and_serialized(): void
    {
        $url = $this->uploadCommentImage();

        $comment = $this->withToken($this->token)
            ->postJson("/api/posts/{$this->post->id}/comments", [
                'attachment' => ['type' => 'image', 'url' => $url, 'width' => 640, 'height' => 480],
            ])
            ->assertCreated()
            ->json('comment');

        $this->assertSame('', $comment['body']);
        $this->assertSame('image', $comment['attachment']['type']);
        $this->assertStringStartsWith('/storage/comment-images/', $comment['attachment']['url']);
        $this->assertSame(640, $comment['attachment']['width']);

        $this->assertDatabaseHas('notifications', [
            'user_id' => (string) $this->post->author_user_id,
        ]);
    }

    public function test_gif_comment_with_text_is_accepted(): void
    {
        $comment = $this->withToken($this->token)
            ->postJson("/api/posts/{$this->post->id}/comments", [
                'body' => 'Congrats!',
                'attachment' => ['type' => 'gif', 'url' => 'https://media2.giphy.com/media/abc/200.gif'],
            ])
            ->assertCreated()
            ->json('comment');

        $this->assertSame('Congrats!', $comment['body']);
        $this->assertSame('gif', $comment['attachment']['type']);
    }

    public function test_rejects_foreign_urls_and_empty_comments(): void
    {
        $endpoint = "/api/posts/{$this->post->id}/comments";

        $this->withToken($this->token)
            ->postJson($endpoint, ['attachment' => ['type' => 'gif', 'url' => 'https://evil.example.com/a.gif']])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('attachment.url');

        $this->withToken($this->token)
            ->postJson($endpoint, ['attachment' => ['type' => 'image', 'url' => 'https://evil.example.com/a.jpg']])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('attachment.url');

        // Path looks right but the file was never uploaded.
        $this->withToken($this->token)
            ->postJson($endpoint, ['attachment' => ['type' => 'image', 'url' => '/storage/comment-images/missing.jpg']])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('attachment.url');

        $this->withToken($this->token)
            ->postJson($endpoint, ['body' => '   '])
            ->assertUnprocessable();
    }

    public function test_gif_search_proxies_giphy_without_exposing_the_key(): void
    {
        config(['services.giphy.key' => 'secret-key']);
        Http::fake([
            'api.giphy.com/*' => Http::response(['data' => [[
                'id' => 'g1',
                'title' => 'Party',
                'images' => [
                    'fixed_height' => ['url' => 'https://media1.giphy.com/media/g1/200.gif', 'width' => '356', 'height' => '200'],
                    'fixed_width_small' => ['url' => 'https://media1.giphy.com/media/g1/100w.gif'],
                ],
            ]]]),
        ]);

        $response = $this->withToken($this->token)
            ->getJson('/api/gifs?q=party')
            ->assertOk();

        $response->assertJsonPath('enabled', true)
            ->assertJsonPath('gifs.0.url', 'https://media1.giphy.com/media/g1/200.gif')
            ->assertJsonPath('gifs.0.width', 356);
        $this->assertStringNotContainsString('secret-key', $response->getContent());

        Http::assertSent(fn ($request) => str_contains($request->url(), '/v1/gifs/search')
            && $request['q'] === 'party'
            && $request['rating'] === 'g');
    }

    public function test_gif_search_reports_disabled_without_a_key(): void
    {
        config(['services.giphy.key' => null]);

        $this->withToken($this->token)
            ->getJson('/api/gifs')
            ->assertOk()
            ->assertJson(['enabled' => false, 'gifs' => []]);

        $this->flushHeaders()->getJson('/api/gifs')->assertUnauthorized();
    }
}
