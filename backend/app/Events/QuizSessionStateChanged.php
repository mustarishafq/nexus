<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class QuizSessionStateChanged implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $sessionId,
        public string $eventName,
        public ?string $status = null,
        public ?int $currentQuestionId = null,
        public ?int $stateVersion = null,
    ) {}

    /**
     * @return array<int, \Illuminate\Broadcasting\PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('quiz-session.'.$this->sessionId),
        ];
    }

    public function broadcastAs(): string
    {
        return 'QuizSessionStateChanged';
    }

    /**
     * @return array<string, mixed>
     */
    /**
     * Deliberately minimal — a "what changed and to what" signal, not the
     * full session. Clients still reconcile via a normal GET, but this lets
     * them cheaply recognize a stale/duplicate/out-of-order event without
     * one. See also QuizSessionAnswerCountChanged for the separate,
     * host-only per-answer progress signal.
     */
    public function broadcastWith(): array
    {
        return [
            'session_id' => $this->sessionId,
            'event' => $this->eventName,
            'status' => $this->status,
            'current_question_id' => $this->currentQuestionId,
            'state_version' => $this->stateVersion,
        ];
    }
}
