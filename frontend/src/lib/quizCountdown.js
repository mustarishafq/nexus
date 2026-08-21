export function quizCountdownRemainingMs(session, now = Date.now()) {
	if (!session || session.status !== 'question' || session.paused) return 0;
	if (session.answering_open === true) return 0;
	const started = session.question_started_at ? Date.parse(session.question_started_at) : 0;
	if (!Number.isFinite(started) || started <= 0) return 0;
	return Math.max(0, started - now);
}

export function quizCountdownLabel(ms) {
	if (ms <= 0) return null;
	if (ms > 2000) return '3';
	if (ms > 1000) return '2';
	if (ms > 350) return '1';
	return 'GO!';
}

export function isQuizAnsweringOpen(session, now = Date.now()) {
	if (!session || session.status !== 'question' || session.paused) return false;
	if (quizCountdownRemainingMs(session, now) > 0) return false;
	if (session.answering_open === true) return true;
	const started = session.question_started_at ? Date.parse(session.question_started_at) : 0;
	return Number.isFinite(started) && started > 0 && started <= now;
}

export function questionTimerState(session, question, now = Date.now()) {
	const limit = Math.max(1, Number(question?.time_limit_seconds) || 20);
	if (!question || session?.status !== 'question') {
		return { remainingSeconds: 0, timedOut: false, countdownMs: 0 };
	}

	const countdownMs = quizCountdownRemainingMs(session, now);
	if (session?.paused) {
		const pauseMs = Math.max(0, Number(session.pause_remaining_ms) || 0);
		if (pauseMs > limit * 1000) {
			return { remainingSeconds: limit, timedOut: false, countdownMs: pauseMs - limit * 1000 };
		}
		return {
			remainingSeconds: Math.max(0, Math.ceil(pauseMs / 1000)),
			timedOut: false,
			countdownMs: 0,
		};
	}

	if (countdownMs > 0) {
		return { remainingSeconds: limit, timedOut: false, countdownMs };
	}

	const endsAt = session?.question_ends_at
		? Date.parse(session.question_ends_at)
		: (session?.question_started_at
			? Date.parse(session.question_started_at) + limit * 1000
			: null);

	if (!Number.isFinite(endsAt) || !endsAt) {
		return { remainingSeconds: limit, timedOut: false, countdownMs: 0 };
	}

	const left = Math.max(0, Math.ceil((endsAt - now) / 1000));
	return { remainingSeconds: left, timedOut: left <= 0, countdownMs: 0 };
}
