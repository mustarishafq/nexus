<?php

namespace Tests\Feature;

use App\Models\Quiz;
use App\Models\QuizSession;
use App\Models\User;
use App\Support\ApiTokenAuth;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\GrantsUserRoleQuizPlayAccess;
use Tests\TestCase;

class QuizBuilderTest extends TestCase
{
    use RefreshDatabase;
    use GrantsUserRoleQuizPlayAccess;

    private function token(User $user): string
    {
        return ApiTokenAuth::issueToken($user);
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function sampleQuestion(string $prompt = 'What is 2 + 2?', array $overrides = []): array
    {
        return array_merge([
            'prompt' => $prompt,
            'time_limit_seconds' => 20,
            'points_base' => 1000,
            'image_url' => null,
            'options' => [
                ['label' => '3', 'is_correct' => false],
                ['label' => '4', 'is_correct' => true],
                ['label' => '5', 'is_correct' => false],
                ['label' => '6', 'is_correct' => false],
            ],
        ], $overrides);
    }

    /**
     * @param  list<array<string, mixed>>  $questions
     */
    private function createQuiz(User $user, array $questions, string $status = Quiz::STATUS_DRAFT): Quiz
    {
        $id = $this->withToken($this->token($user))
            ->postJson('/api/quizzes', [
                'title' => 'Builder Quiz',
                'status' => $status,
                'questions' => $questions,
            ])
            ->assertCreated()
            ->json('id');

        return Quiz::with('questions.options')->findOrFail($id);
    }

    public function test_duplicate_question_payload_creates_independent_rows_with_sort_order(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $quiz = $this->createQuiz($user, [
            $this->sampleQuestion('Original'),
            $this->sampleQuestion('Other'),
        ]);

        $original = $this->sampleQuestion('Original');
        $copy = $this->sampleQuestion('Original copy', ['time_limit_seconds' => 45, 'points_base' => 2000]);
        $other = $this->sampleQuestion('Other');

        $this->withToken($this->token($user))
            ->putJson("/api/quizzes/{$quiz->id}", [
                'questions' => [$original, $copy, $other],
            ])
            ->assertOk();

        $quiz->refresh()->load('questions.options');
        $this->assertCount(3, $quiz->questions);
        $this->assertSame([0, 1, 2], $quiz->questions->pluck('sort_order')->all());
        $this->assertSame(['Original', 'Original copy', 'Other'], $quiz->questions->pluck('prompt')->all());
        $this->assertNotSame($quiz->questions[0]->id, $quiz->questions[1]->id);

        $firstOptionIds = $quiz->questions[0]->options->pluck('id')->all();
        $copyOptionIds = $quiz->questions[1]->options->pluck('id')->all();
        $this->assertEmpty(array_intersect($firstOptionIds, $copyOptionIds));

        $this->withToken($this->token($user))
            ->putJson("/api/quizzes/{$quiz->id}", [
                'questions' => [
                    $this->sampleQuestion('Original'),
                    $this->sampleQuestion('Edited copy'),
                    $this->sampleQuestion('Other'),
                ],
            ])
            ->assertOk();

        $quiz->refresh()->load('questions');
        $this->assertSame(['Original', 'Edited copy', 'Other'], $quiz->questions->pluck('prompt')->all());
    }

    public function test_draft_cannot_contain_exact_duplicate_questions(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $dupes = [$this->sampleQuestion(), $this->sampleQuestion()];

        $response = $this->withToken($this->token($user))
            ->postJson('/api/quizzes', [
                'title' => 'Builder Quiz',
                'status' => Quiz::STATUS_DRAFT,
                'questions' => $dupes,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['questions']);

        $this->assertStringContainsString(
            'Questions 1 and 2 are identical',
            $response->json('errors.questions.0'),
        );
        $this->assertStringContainsString('before saving', $response->json('errors.questions.0'));
        $this->assertSame(0, Quiz::query()->count());
    }

    public function test_publishing_exact_duplicate_questions_is_rejected_and_does_not_mutate_quiz(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $quiz = $this->createQuiz($user, [
            $this->sampleQuestion('Keep me'),
            $this->sampleQuestion('Also unique'),
        ]);

        $response = $this->withToken($this->token($user))
            ->putJson("/api/quizzes/{$quiz->id}", [
                'status' => Quiz::STATUS_PUBLISHED,
                'questions' => [$this->sampleQuestion(), $this->sampleQuestion()],
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['questions']);

        $this->assertStringContainsString(
            'Questions 1 and 2 are identical',
            $response->json('errors.questions.0'),
        );

        $quiz->refresh()->load('questions');
        $this->assertSame(Quiz::STATUS_DRAFT, $quiz->status);
        $this->assertSame(['Keep me', 'Also unique'], $quiz->questions->pluck('prompt')->all());
    }

    public function test_saving_draft_with_exact_duplicate_questions_is_rejected_and_does_not_mutate_quiz(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $quiz = $this->createQuiz($user, [
            $this->sampleQuestion('Keep me'),
            $this->sampleQuestion('Also unique'),
        ]);

        $this->withToken($this->token($user))
            ->putJson("/api/quizzes/{$quiz->id}", [
                'title' => 'Should not save',
                'questions' => [$this->sampleQuestion(), $this->sampleQuestion()],
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['questions']);

        $quiz->refresh()->load('questions');
        $this->assertSame(Quiz::STATUS_DRAFT, $quiz->status);
        $this->assertSame('Builder Quiz', $quiz->title);
        $this->assertSame(['Keep me', 'Also unique'], $quiz->questions->pluck('prompt')->all());
    }

    public function test_published_quiz_cannot_be_saved_with_exact_duplicates(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $quiz = $this->createQuiz($user, [
            $this->sampleQuestion('Alpha'),
            $this->sampleQuestion('Beta'),
        ], Quiz::STATUS_PUBLISHED);

        $this->withToken($this->token($user))
            ->putJson("/api/quizzes/{$quiz->id}", [
                'questions' => [$this->sampleQuestion(), $this->sampleQuestion()],
            ])
            ->assertStatus(422);

        $quiz->refresh()->load('questions');
        $this->assertSame(['Alpha', 'Beta'], $quiz->questions->pluck('prompt')->all());
    }

    public function test_same_prompt_with_different_correct_answer_can_be_published(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $shifted = $this->sampleQuestion('What is 2 + 2?', [
            'options' => [
                ['label' => '3', 'is_correct' => false],
                ['label' => '4', 'is_correct' => false],
                ['label' => '5', 'is_correct' => true],
                ['label' => '6', 'is_correct' => false],
            ],
        ]);

        $this->withToken($this->token($user))
            ->postJson('/api/quizzes', [
                'title' => 'Publishable',
                'status' => Quiz::STATUS_PUBLISHED,
                'questions' => [$this->sampleQuestion(), $shifted],
            ])
            ->assertCreated()
            ->assertJsonPath('status', Quiz::STATUS_PUBLISHED);
    }

    public function test_different_prompt_with_same_options_can_be_published(): void
    {
        $user = User::factory()->create(['is_approved' => true]);

        $this->withToken($this->token($user))
            ->postJson('/api/quizzes', [
                'title' => 'Publishable',
                'status' => Quiz::STATUS_PUBLISHED,
                'questions' => [
                    $this->sampleQuestion('What is 2 + 2?'),
                    $this->sampleQuestion('What is 3 + 1?'),
                ],
            ])
            ->assertCreated();
    }

    public function test_same_content_with_different_image_can_be_published(): void
    {
        $user = User::factory()->create(['is_approved' => true]);

        $this->withToken($this->token($user))
            ->postJson('/api/quizzes', [
                'title' => 'Publishable',
                'status' => Quiz::STATUS_PUBLISHED,
                'questions' => [
                    $this->sampleQuestion('What is 2 + 2?', ['image_url' => '/storage/quiz-question-images/a.jpg']),
                    $this->sampleQuestion('What is 2 + 2?', ['image_url' => '/storage/quiz-question-images/b.jpg']),
                ],
            ])
            ->assertCreated();
    }

    public function test_time_or_points_difference_alone_does_not_make_duplicate_content_unique(): void
    {
        $user = User::factory()->create(['is_approved' => true]);

        $this->withToken($this->token($user))
            ->postJson('/api/quizzes', [
                'title' => 'Blocked',
                'status' => Quiz::STATUS_PUBLISHED,
                'questions' => [
                    $this->sampleQuestion('Same', ['time_limit_seconds' => 20, 'points_base' => 1000]),
                    $this->sampleQuestion('Same', ['time_limit_seconds' => 60, 'points_base' => 1000]),
                ],
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['questions']);

        $this->withToken($this->token($user))
            ->postJson('/api/quizzes', [
                'title' => 'Blocked',
                'status' => Quiz::STATUS_DRAFT,
                'questions' => [
                    $this->sampleQuestion('Same', ['time_limit_seconds' => 20, 'points_base' => 1000]),
                    $this->sampleQuestion('Same', ['time_limit_seconds' => 20, 'points_base' => 2500]),
                ],
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['questions']);
    }

    public function test_apply_time_and_points_payload_then_individual_override(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $quiz = $this->createQuiz($user, [
            $this->sampleQuestion('A', ['time_limit_seconds' => 10, 'points_base' => 500]),
            $this->sampleQuestion('B', ['time_limit_seconds' => 15, 'points_base' => 700]),
        ]);

        $this->withToken($this->token($user))
            ->putJson("/api/quizzes/{$quiz->id}", [
                'questions' => [
                    $this->sampleQuestion('A', ['time_limit_seconds' => 20, 'points_base' => 1000]),
                    $this->sampleQuestion('B', ['time_limit_seconds' => 20, 'points_base' => 1000]),
                ],
            ])
            ->assertOk();

        $quiz->refresh()->load('questions');
        $this->assertSame([20, 20], $quiz->questions->pluck('time_limit_seconds')->all());
        $this->assertSame([1000, 1000], $quiz->questions->pluck('points_base')->all());

        $this->withToken($this->token($user))
            ->putJson("/api/quizzes/{$quiz->id}", [
                'questions' => [
                    $this->sampleQuestion('A', ['time_limit_seconds' => 20, 'points_base' => 1000]),
                    $this->sampleQuestion('B', ['time_limit_seconds' => 60, 'points_base' => 2500]),
                ],
            ])
            ->assertOk();

        $quiz->refresh()->load('questions');
        $this->assertSame([20, 60], $quiz->questions->pluck('time_limit_seconds')->all());
        $this->assertSame([1000, 2500], $quiz->questions->pluck('points_base')->all());
    }

    public function test_question_image_can_be_attached_replaced_and_removed(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $quiz = $this->createQuiz($user, [$this->sampleQuestion('Pic')]);
        $this->assertNull($quiz->questions[0]->image_url);

        $this->withToken($this->token($user))
            ->putJson("/api/quizzes/{$quiz->id}", [
                'questions' => [
                    $this->sampleQuestion('Pic', ['image_url' => '/storage/quiz-question-images/one.jpg']),
                ],
            ])
            ->assertOk()
            ->assertJsonPath('questions.0.image_url', '/storage/quiz-question-images/one.jpg');

        $this->withToken($this->token($user))
            ->putJson("/api/quizzes/{$quiz->id}", [
                'questions' => [
                    $this->sampleQuestion('Pic', ['image_url' => '/storage/quiz-question-images/two.jpg']),
                ],
            ])
            ->assertOk()
            ->assertJsonPath('questions.0.image_url', '/storage/quiz-question-images/two.jpg');

        $this->withToken($this->token($user))
            ->putJson("/api/quizzes/{$quiz->id}", [
                'questions' => [
                    $this->sampleQuestion('Pic', ['image_url' => null]),
                ],
            ])
            ->assertOk();

        $this->assertNull($quiz->fresh()->questions()->first()->image_url);
    }

    public function test_invalid_question_image_upload_is_rejected(): void
    {
        Storage::fake('public');
        $user = User::factory()->create(['is_approved' => true]);

        $this->withToken($this->token($user))
            ->post('/api/uploads', [
                'folder' => 'quiz-question-images',
                'file' => UploadedFile::fake()->create('notes.txt', 20, 'text/plain'),
            ], ['Accept' => 'application/json'])
            ->assertStatus(422);

        $url = $this->withToken($this->token($user))
            ->post('/api/uploads', [
                'folder' => 'quiz-question-images',
                'file' => UploadedFile::fake()->image('diagram.jpg'),
            ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->json('file_url');

        $this->assertIsString($url);
        $this->assertStringContainsString('/storage/quiz-question-images/', $url);
    }

    public function test_existing_quizzes_without_images_still_work_in_play_payload(): void
    {
        $owner = User::factory()->create(['is_approved' => true]);
        $player = User::factory()->create(['is_approved' => true]);
        $quiz = $this->createQuiz($owner, [
            $this->sampleQuestion('A'),
            $this->sampleQuestion('B'),
        ], Quiz::STATUS_PUBLISHED);

        $this->assertNull($quiz->questions[0]->image_url);

        $session = $this->withToken($this->token($player))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'async'])
            ->assertCreated()
            ->json();

        $this->assertArrayHasKey('image_url', $session['quiz']['questions'][0]);
        $this->assertNull($session['quiz']['questions'][0]['image_url']);
        $this->assertCount(2, $session['quiz']['questions']);
    }

    public function test_live_session_includes_question_image_url(): void
    {
        $host = User::factory()->create(['is_approved' => true, 'name' => 'Host']);
        $player = User::factory()->create(['is_approved' => true]);
        $quiz = $this->createQuiz($host, [
            $this->sampleQuestion('Shown', ['image_url' => '/storage/quiz-question-images/live.jpg']),
        ], Quiz::STATUS_PUBLISHED);

        $sessionId = $this->withToken($this->token($host))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'live'])
            ->assertCreated()
            ->json('id');

        $pin = QuizSession::findOrFail($sessionId)->pin;
        $this->withToken($this->token($player))->postJson('/api/quiz-sessions/join', ['pin' => $pin])->assertOk();
        $this->withToken($this->token($host))->postJson("/api/quiz-sessions/{$sessionId}/start")->assertOk();

        $this->withToken($this->token($player))
            ->getJson("/api/quiz-sessions/{$sessionId}")
            ->assertOk()
            ->assertJsonPath('quiz.questions.0.image_url', '/storage/quiz-question-images/live.jpg');
    }

    public function test_existing_create_edit_and_publish_still_work(): void
    {
        $user = User::factory()->create(['is_approved' => true]);

        $quiz = $this->createQuiz($user, [$this->sampleQuestion('One')]);
        $this->withToken($this->token($user))
            ->putJson("/api/quizzes/{$quiz->id}", [
                'title' => 'Renamed',
                'status' => Quiz::STATUS_PUBLISHED,
                'questions' => [$this->sampleQuestion('One'), $this->sampleQuestion('Two')],
            ])
            ->assertOk()
            ->assertJsonPath('title', 'Renamed')
            ->assertJsonPath('status', Quiz::STATUS_PUBLISHED);

        $this->assertCount(2, $quiz->fresh()->questions);
    }

    public function test_published_question_endpoint_cannot_add_or_edit_into_duplicates(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $quiz = $this->createQuiz($user, [
            $this->sampleQuestion('What is 1 + 1?'),
            $this->sampleQuestion('Other'),
        ], Quiz::STATUS_PUBLISHED);

        $originalIds = $quiz->questions->pluck('id')->all();
        $duplicate = $this->sampleQuestion('What is 1 + 1?');

        $this->withToken($this->token($user))
            ->postJson("/api/quizzes/{$quiz->id}/questions", $duplicate)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['questions']);

        $this->assertSame($originalIds, $quiz->fresh()->questions()->pluck('id')->all());

        $otherId = $quiz->questions->last()->id;
        $this->withToken($this->token($user))
            ->putJson("/api/quizzes/{$quiz->id}/questions/{$otherId}", $duplicate)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['questions']);

        $this->assertSame('Other', $quiz->fresh()->questions()->orderBy('sort_order')->get()->last()->prompt);
    }

    public function test_integer_correct_flags_still_detect_published_duplicates(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $options = [
            ['label' => '1', 'is_correct' => 0],
            ['label' => '2', 'is_correct' => 1],
            ['label' => '3', 'is_correct' => 0],
            ['label' => '4', 'is_correct' => 0],
        ];

        $this->withToken($this->token($user))
            ->postJson('/api/quizzes', [
                'title' => 'Flags',
                'status' => Quiz::STATUS_PUBLISHED,
                'questions' => [
                    $this->sampleQuestion('What is 1 + 1?', ['options' => $options]),
                    $this->sampleQuestion('What is 1 + 1?', ['options' => $options]),
                ],
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['questions']);
    }

    public function test_image_url_survives_create_get_and_update(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $absolute = 'http://localhost:8000/storage/quiz-question-images/created.jpg';

        $id = $this->withToken($this->token($user))
            ->postJson('/api/quizzes', [
                'title' => 'With image',
                'status' => Quiz::STATUS_DRAFT,
                'questions' => [
                    $this->sampleQuestion('Shown', ['image_url' => $absolute]),
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('questions.0.image_url', '/storage/quiz-question-images/created.jpg')
            ->json('id');

        $this->withToken($this->token($user))
            ->getJson("/api/quizzes/{$id}")
            ->assertOk()
            ->assertJsonPath('questions.0.image_url', '/storage/quiz-question-images/created.jpg');

        $this->withToken($this->token($user))
            ->putJson("/api/quizzes/{$id}", [
                'questions' => [
                    $this->sampleQuestion('Shown', [
                        'image_url' => 'http://127.0.0.1:8000/api/storage/quiz-question-images/updated.jpg',
                    ]),
                ],
            ])
            ->assertOk()
            ->assertJsonPath('questions.0.image_url', '/storage/quiz-question-images/updated.jpg');

        $this->assertSame(
            '/storage/quiz-question-images/updated.jpg',
            Quiz::findOrFail($id)->questions()->first()->image_url,
        );
    }

    public function test_upload_url_can_be_saved_on_question_and_returned_in_quiz_payload(): void
    {
        Storage::fake('public');
        $user = User::factory()->create(['is_approved' => true]);

        $fileUrl = $this->withToken($this->token($user))
            ->post('/api/uploads', [
                'folder' => 'quiz-question-images',
                'file' => UploadedFile::fake()->image('diagram.jpg'),
            ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->json('file_url');

        $quiz = $this->createQuiz($user, [
            $this->sampleQuestion('Pic', ['image_url' => $fileUrl]),
        ]);

        $stored = $quiz->questions[0]->image_url;
        $this->assertNotNull($stored);
        $this->assertStringStartsWith('/storage/quiz-question-images/', $stored);

        $this->withToken($this->token($user))
            ->getJson("/api/quizzes/{$quiz->id}")
            ->assertOk()
            ->assertJsonPath('questions.0.image_url', $stored);
    }

    public function test_questions_default_to_multiple_choice_and_reject_unsupported_types(): void
    {
        $user = User::factory()->create(['is_approved' => true]);

        $created = $this->withToken($this->token($user))
            ->postJson('/api/quizzes', [
                'title' => 'Typed',
                'questions' => [$this->sampleQuestion('One')],
            ])
            ->assertCreated();

        $this->assertSame('multiple_choice', $created->json('questions.0.question_type'));

        $id = $created->json('id');
        $this->withToken($this->token($user))
            ->putJson("/api/quizzes/{$id}", [
                'questions' => [
                    $this->sampleQuestion('One', ['question_type' => 'multiple_choice']),
                    $this->sampleQuestion('Two', ['question_type' => 'multiple_choice']),
                ],
            ])
            ->assertOk()
            ->assertJsonPath('questions.0.question_type', 'multiple_choice')
            ->assertJsonPath('questions.1.question_type', 'multiple_choice');

        $this->withToken($this->token($user))
            ->putJson("/api/quizzes/{$id}", [
                'questions' => [
                    $this->sampleQuestion('One', ['question_type' => 'true_false']),
                ],
            ])
            ->assertStatus(422);

        $this->withToken($this->token($user))
            ->putJson("/api/quizzes/{$id}", [
                'questions' => [
                    $this->sampleQuestion('One', ['question_type' => 'short_answer']),
                ],
            ])
            ->assertStatus(422);

        $this->withToken($this->token($user))
            ->getJson("/api/quizzes/{$id}")
            ->assertOk()
            ->assertJsonPath('questions.0.question_type', 'multiple_choice');
    }

    public function test_question_type_survives_duplication_payload_and_session_serialization(): void
    {
        $owner = User::factory()->create(['is_approved' => true]);
        $player = User::factory()->create(['is_approved' => true]);
        $quiz = $this->createQuiz($owner, [
            $this->sampleQuestion('Keep type', ['question_type' => 'multiple_choice']),
        ], Quiz::STATUS_PUBLISHED);

        $this->withToken($this->token($owner))
            ->putJson("/api/quizzes/{$quiz->id}", [
                'questions' => [
                    $this->sampleQuestion('Keep type', ['question_type' => 'multiple_choice']),
                    $this->sampleQuestion('Keep type copy', ['question_type' => 'multiple_choice']),
                ],
            ])
            ->assertOk();

        $quiz->refresh()->load('questions');
        $this->assertSame(
            ['multiple_choice', 'multiple_choice'],
            $quiz->questions->pluck('question_type')->all()
        );

        $session = $this->withToken($this->token($player))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'async'])
            ->assertCreated()
            ->json();

        $this->assertSame('multiple_choice', $session['quiz']['questions'][0]['question_type']);
    }

    public function test_cannot_edit_quiz_while_live_session_is_active(): void
    {
        $host = User::factory()->create(['is_approved' => true, 'name' => 'Host']);
        $player = User::factory()->create(['is_approved' => true]);
        $quiz = $this->createQuiz($host, [$this->sampleQuestion('A'), $this->sampleQuestion('B')], Quiz::STATUS_PUBLISHED);

        $sessionId = $this->withToken($this->token($host))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'live'])
            ->assertCreated()
            ->json('id');
        $pin = QuizSession::findOrFail($sessionId)->pin;
        $this->withToken($this->token($player))->postJson('/api/quiz-sessions/join', ['pin' => $pin])->assertOk();

        $this->withToken($this->token($host))
            ->putJson("/api/quizzes/{$quiz->id}", ['title' => 'Lobby edit'])
            ->assertOk();

        $this->withToken($this->token($host))->postJson("/api/quiz-sessions/{$sessionId}/start")->assertOk();

        $this->withToken($this->token($host))
            ->putJson("/api/quizzes/{$quiz->id}", ['title' => 'Mid-game edit'])
            ->assertStatus(422);
    }
}
