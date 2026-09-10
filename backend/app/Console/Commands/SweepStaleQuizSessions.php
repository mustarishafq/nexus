<?php

namespace App\Console\Commands;

use App\Models\QuizSession;
use App\Services\QuizGameService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * Safety net for the Live Quiz's server-authoritative transitions.
 *
 * The primary mechanism is a delayed queue job dispatched for each phase's
 * own deadline (see QuizGameService::dispatchNextTick / AdvanceQuizSessionJob).
 * This command exists purely as a low-frequency backstop in case that job
 * was ever lost (queue worker was down, a deploy restarted workers mid-job,
 * etc.) — it should normally find nothing to do. It is intentionally cheap:
 * a single indexed query for sessions that are actually active and whose
 * current deadline has already elapsed, then the same lock-guarded
 * hydrateLiveSession() every HTTP poll already uses, so it carries no risk
 * of double-advancing a session beyond what already existed.
 */
class SweepStaleQuizSessions extends Command
{
    protected $signature = 'quiz:sweep-stale-sessions';

    protected $description = 'Advance any live quiz sessions whose deadline has passed but were not ticked by their scheduled job';

    public function handle(QuizGameService $service): int
    {
        $cutoff = now();

        $sessions = QuizSession::query()
            ->where('mode', QuizSession::MODE_LIVE)
            ->whereNotIn('status', [QuizSession::STATUS_LOBBY, QuizSession::STATUS_FINISHED])
            ->whereNull('paused_at')
            ->where(function ($query) use ($cutoff) {
                $query->where('question_ends_at', '<=', $cutoff)
                    ->orWhere('phase_ends_at', '<=', $cutoff);
            })
            ->get();

        $advanced = 0;

        foreach ($sessions as $session) {
            $before = $session->state_version;
            $service->hydrateLiveSession($session);

            if ((int) $session->state_version !== (int) $before) {
                $advanced++;
                Log::info('Swept a stale live quiz session that missed its tick job.', [
                    'session_id' => $session->id,
                    'status' => $session->status,
                ]);
            }
        }

        $this->info("Checked {$sessions->count()} stale-looking live session(s), advanced {$advanced}.");

        return self::SUCCESS;
    }
}
