<?php

use App\Models\QuizSession;
use Illuminate\Support\Facades\Broadcast;

/*
| Channel authorization for quiz live sessions.
| Auth is resolved via Broadcast::routes custom middleware + Bearer token.
*/

Broadcast::channel('quiz-session.{sessionId}', function ($user, int $sessionId) {
    if (! $user?->is_approved) {
        return false;
    }

    $session = QuizSession::query()->find($sessionId);
    if (! $session) {
        return false;
    }

    if ((int) $session->host_user_id === (int) $user->id) {
        return ['id' => $user->id, 'role' => 'host'];
    }

    if ($session->players()->where('user_id', $user->id)->exists()) {
        return ['id' => $user->id, 'role' => 'player'];
    }

    return false;
});
