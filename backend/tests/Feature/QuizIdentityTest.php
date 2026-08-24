<?php

namespace Tests\Feature;

use App\Models\Quiz;
use App\Models\QuizOption;
use App\Models\QuizQuestion;
use App\Models\QuizSession;
use App\Models\QuizSessionPlayer;
use App\Models\User;
use App\Support\ApiTokenAuth;
use App\Support\QuizAccessories;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\GrantsUserRoleQuizPlayAccess;
use Tests\TestCase;

class QuizIdentityTest extends TestCase
{
    use RefreshDatabase;
    use GrantsUserRoleQuizPlayAccess;

    private function token(User $user): string
    {
        return ApiTokenAuth::issueToken($user);
    }

    private function makePublishedQuiz(User $owner): Quiz
    {
        $quiz = Quiz::create([
            'user_id' => $owner->id,
            'title' => 'Identity Quiz',
            'status' => Quiz::STATUS_PUBLISHED,
        ]);

        $question = QuizQuestion::create([
            'quiz_id' => $quiz->id,
            'prompt' => 'Hello?',
            'time_limit_seconds' => 20,
            'points_base' => 1000,
            'sort_order' => 0,
        ]);
        QuizOption::create([
            'quiz_question_id' => $question->id,
            'label' => 'Hi',
            'is_correct' => true,
            'sort_order' => 0,
        ]);
        QuizOption::create([
            'quiz_question_id' => $question->id,
            'label' => 'Bye',
            'is_correct' => false,
            'sort_order' => 1,
        ]);

        return $quiz->fresh(['questions']);
    }

    public function test_user_can_select_and_clear_quiz_accessory(): void
    {
        $user = User::factory()->create(['is_approved' => true, 'quiz_accessory_id' => null]);

        $this->withToken($this->token($user))
            ->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('quiz_accessory_id', null);

        $this->withToken($this->token($user))
            ->patchJson('/api/me', ['quiz_accessory_id' => 'crown'])
            ->assertOk()
            ->assertJsonPath('quiz_accessory_id', 'crown');

        $this->withToken($this->token($user))
            ->patchJson('/api/me', ['quiz_accessory_id' => 'none'])
            ->assertOk()
            ->assertJsonPath('quiz_accessory_id', null);
    }

    public function test_invalid_accessory_id_is_rejected(): void
    {
        $user = User::factory()->create(['is_approved' => true]);

        $this->withToken($this->token($user))
            ->patchJson('/api/me', ['quiz_accessory_id' => 'jetpack'])
            ->assertStatus(422);
    }

    public function test_session_player_snapshots_accessory_and_keeps_it_after_profile_change(): void
    {
        $host = User::factory()->create(['is_approved' => true, 'name' => 'Host']);
        $player = User::factory()->create([
            'is_approved' => true,
            'name' => 'Player',
            'profile_picture' => '/storage/profile-pictures/a.jpg',
            'profile_picture_crop' => ['x' => 10, 'y' => 12, 'width' => 70, 'height' => 70],
            'quiz_accessory_id' => 'crown',
        ]);
        $quiz = $this->makePublishedQuiz($host);

        $sessionId = $this->withToken($this->token($host))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'live'])
            ->assertCreated()
            ->json('id');

        $pin = QuizSession::findOrFail($sessionId)->pin;
        $this->withToken($this->token($player))
            ->postJson('/api/quiz-sessions/join', ['pin' => $pin])
            ->assertOk();

        $this->withToken($this->token($player))
            ->patchJson('/api/me', [
                'quiz_accessory_id' => 'headphones',
                'profile_picture' => '/storage/profile-pictures/b.jpg',
                'profile_picture_crop' => ['x' => 0, 'y' => 0, 'width' => 100, 'height' => 100],
            ])
            ->assertOk();

        $payload = $this->withToken($this->token($host))
            ->getJson("/api/quiz-sessions/{$sessionId}")
            ->assertOk()
            ->json();

        $row = collect($payload['players'])->firstWhere('user_id', $player->id);
        $this->assertNotNull($row);
        $this->assertSame('crown', $row['accessory_id']);
        $this->assertSame('/storage/profile-pictures/a.jpg', $row['profile_picture']);
        $this->assertEqualsWithDelta(10, $row['profile_picture_crop']['x'], 0.01);
        $this->assertEqualsWithDelta(70, $row['profile_picture_crop']['width'], 0.01);

        $snapshot = QuizSessionPlayer::query()
            ->where('quiz_session_id', $sessionId)
            ->where('user_id', $player->id)
            ->first();
        $this->assertSame('crown', $snapshot->quiz_accessory_id);
        $this->assertSame('headphones', $player->fresh()->quiz_accessory_id);
        $this->assertEqualsWithDelta(10, $snapshot->profile_picture_crop['x'], 0.01);
        $this->assertEqualsWithDelta(0, $player->fresh()->profile_picture_crop['x'], 0.01);
    }

    public function test_workplace_catalog_maps_legacy_ids_and_rejects_unknown(): void
    {
        $this->assertCount(15, QuizAccessories::IDS);
        $this->assertNotContains('devil_horns', QuizAccessories::IDS);
        $this->assertSame('sparkle', QuizAccessories::normalize('devil_horns'));
        $this->assertSame('crown', QuizAccessories::normalize('crown'));
        $this->assertSame('headphones', QuizAccessories::normalize('headphones'));
        $this->assertNull(QuizAccessories::normalize('jetpack'));

        $user = User::factory()->create(['is_approved' => true, 'quiz_accessory_id' => null]);
        DB::table('users')->where('id', $user->id)->update(['quiz_accessory_id' => 'devil_horns']);

        $this->withToken($this->token($user))
            ->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('quiz_accessory_id', 'sparkle');

        $this->withToken($this->token($user))
            ->patchJson('/api/me', ['quiz_accessory_id' => 'party_hat'])
            ->assertOk()
            ->assertJsonPath('quiz_accessory_id', 'sparkle');
    }

    public function test_profile_picture_upload_is_canonicalized_and_persisted(): void
    {
        Storage::fake('public');
        $user = User::factory()->create(['is_approved' => true, 'profile_picture' => null]);

        $fileUrl = $this->withToken($this->token($user))
            ->post('/api/uploads', [
                'folder' => 'profile-pictures',
                'file' => UploadedFile::fake()->image('avatar.jpg'),
            ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->json('file_url');

        $this->assertIsString($fileUrl);
        $this->assertStringStartsWith('/storage/profile-pictures/', $fileUrl);
        Storage::disk('public')->assertExists(ltrim(substr($fileUrl, strlen('/storage/')), '/'));

        $this->withToken($this->token($user))
            ->patchJson('/api/me', [
                'profile_picture' => 'http://localhost:8000'.$fileUrl,
                'profile_picture_crop' => ['x' => 5, 'y' => 8, 'width' => 80, 'height' => 80],
            ])
            ->assertOk()
            ->assertJsonPath('profile_picture', $fileUrl)
            ->assertJsonPath('profile_picture_crop.width', 80);

        $this->withToken($this->token($user))
            ->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('profile_picture', $fileUrl);
    }

    public function test_existing_games_without_accessory_or_crop_still_work(): void
    {
        $host = User::factory()->create(['is_approved' => true, 'name' => 'Host']);
        $player = User::factory()->create(['is_approved' => true, 'quiz_accessory_id' => null]);
        $quiz = $this->makePublishedQuiz($host);

        $sessionId = $this->withToken($this->token($host))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'live'])
            ->assertCreated()
            ->json('id');
        $pin = QuizSession::findOrFail($sessionId)->pin;
        $this->withToken($this->token($player))->postJson('/api/quiz-sessions/join', ['pin' => $pin])->assertOk();

        $this->withToken($this->token($host))
            ->getJson("/api/quiz-sessions/{$sessionId}")
            ->assertOk()
            ->assertJsonPath('players.0.accessory_id', null)
            ->assertJsonPath('players.0.profile_picture_crop', null)
            ->assertJsonPath('quiz.questions.0.question_type', 'multiple_choice');
    }

    public function test_model_created_questions_default_to_multiple_choice(): void
    {
        $owner = User::factory()->create(['is_approved' => true]);
        $quiz = $this->makePublishedQuiz($owner);

        $this->assertSame('multiple_choice', $quiz->questions->first()->question_type);
    }
}
