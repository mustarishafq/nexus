<?php

return [
    'host_heartbeat_grace_seconds' => (int) env('QUIZ_HOST_HEARTBEAT_GRACE_SECONDS', 12),
    'host_heartbeat_interval_seconds' => (int) env('QUIZ_HOST_HEARTBEAT_INTERVAL_SECONDS', 5),
    'distribution_seconds' => (int) env('QUIZ_DISTRIBUTION_SECONDS', 4),
    'recap_seconds' => (int) env('QUIZ_RECAP_SECONDS', 5),
    // How long an in-progress live game keeps the quiz locked for edit/delete
    // after the host was last seen. Lobbies never lock the quiz.
    'live_session_lock_minutes' => (int) env('QUIZ_LIVE_SESSION_LOCK_MINUTES', 20),
    // Extra pre-question time before Q1 answering opens in live games only.
    'first_question_countdown_seconds' => (int) env('QUIZ_FIRST_QUESTION_COUNTDOWN_SECONDS', 3),
    // A live player must have been seen this recently at finish to receive quiz EXP.
    'player_presence_grace_seconds' => (int) env('QUIZ_PLAYER_PRESENCE_GRACE_SECONDS', 20),
];
