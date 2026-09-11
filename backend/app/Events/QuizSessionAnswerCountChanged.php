<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Lightweight, host-only progress signal for the current question's answer
 * count. Deliberately broadcast on a separate private channel from
 * QuizSessionStateChanged so ordinary participants never receive (or pay
 * the cost of reacting to) another participant's answer — only the host,
 * who is the only viewer that needs a live "N have answered" count, is
 * subscribed to this channel. The count is carried directly in the
 * payload so the host never needs to refetch the full session for this.
 */
class QuizSessionAnswerCountChanged implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $sessionId,
        public int $questionId,
        public int $answerCount,
    ) {}

    /**
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('quiz-session.'.$this->sessionId.'.host'),
        ];
    }

    public function broadcastAs(): string
    {
        return 'QuizSessionAnswerCountChanged';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'session_id' => $this->sessionId,
            'question_id' => $this->questionId,
            'answer_count' => $this->answerCount,
        ];
    }
}
