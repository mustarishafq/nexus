<?php

namespace App\Jobs;

use App\Models\QuizSession;
use App\Services\QuizGameService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Server-authoritative "tick" for one Live Quiz session. Dispatched with a
 * delay matching the phase's own deadline (question_ends_at / phase_ends_at)
 * every time QuizGameService starts a question/reveal/leaderboard/resume
 * phase, so the session advances on the server's own schedule instead of
 * waiting for a participant's browser to notice the deadline has passed.
 *
 * This does not duplicate QuizGameService's transition logic — it simply
 * triggers the same lock-guarded hydrateLiveSession() that HTTP polling has
 * always used, so every existing correctness guarantee (row lock, status
 * checks, idempotent no-ops) applies unchanged. Safe to run from any number
 * of concurrent queue workers: the state_version check below is a cheap,
 * unlocked fast path for the common case where the session has already
 * moved on (e.g. the host advanced manually, or another worker/job already
 * handled this deadline); the row lock inside hydrateLiveSession() is the
 * actual correctness guard against a genuine race.
 */
class AdvanceQuizSessionJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 2;

    public int $timeout = 30;

    // Deliberately left on the connection's default queue (not a dedicated
    // "quiz" queue): the app's existing queue worker (see composer.json's
    // `dev` script / install.md) already listens to `default`, so this
    // requires no new deployment step. An operator who wants tighter tick
    // latency under heavy load can still route this to its own queue later
    // (the same way `mail-inbox` already does — see install.md) by adding
    // `->onQueue('quiz')` here and `--queue=quiz,default` to the worker.
    public function __construct(
        public int $sessionId,
        public int $expectedStateVersion,
    ) {}

    public function handle(QuizGameService $service): void
    {
        $session = QuizSession::query()->find($this->sessionId);

        if (! $session || $session->mode !== QuizSession::MODE_LIVE) {
            return;
        }

        if ((int) $session->state_version !== $this->expectedStateVersion) {
            // Something else already advanced (or paused/finished) this
            // session since this job was scheduled — nothing to do.
            return;
        }

        $service->hydrateLiveSession($session);
    }

    public function failed(?Throwable $exception): void
    {
        Log::warning('Live quiz session tick job failed.', [
            'session_id' => $this->sessionId,
            'expected_state_version' => $this->expectedStateVersion,
            'error' => $exception?->getMessage(),
        ]);
    }
}
