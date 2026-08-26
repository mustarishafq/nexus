export function attachSessionClock(session, receivedAt = Date.now(), { overwrite = false } = {}) {
	if (!session || typeof session !== 'object') return session;
	if (!overwrite && Number.isFinite(Number(session._clientReceivedAt)) && Number(session._clientReceivedAt) > 0) {
		return session;
	}
	const ts = Number(receivedAt);
	return {
		...session,
		_clientReceivedAt: Number.isFinite(ts) && ts > 0 ? ts : Date.now(),
	};
}

export function sessionNowMs(session, now = Date.now()) {
	const serverNow = session?.server_now ? Date.parse(session.server_now) : NaN;
	const capturedAt = Number(session?._clientReceivedAt);
	if (!Number.isFinite(serverNow) || !Number.isFinite(capturedAt) || capturedAt <= 0) {
		return now;
	}
	return serverNow + (now - capturedAt);
}

export function isQuizFirstQuestion(session) {
	return Number(session?.quiz?.current_question_number) === 1;
}

export function questionPreStartMs(session, now = Date.now()) {
	if (!session || session.status !== 'question' || session.paused) return 0;
	if (session.answering_open === true) return 0;
	const started = session.question_started_at ? Date.parse(session.question_started_at) : 0;
	if (!Number.isFinite(started) || started <= 0) return 0;
	return Math.max(0, started - sessionNowMs(session, now));
}

export function quizCountdownRemainingMs(session, now = Date.now()) {
	if (!isQuizFirstQuestion(session)) return 0;
	return questionPreStartMs(session, now);
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
	if (questionPreStartMs(session, now) > 0) return false;
	if (session.answering_open === true) return true;
	const started = session.question_started_at ? Date.parse(session.question_started_at) : 0;
	return Number.isFinite(started) && started > 0 && started <= sessionNowMs(session, now);
}

export function questionTimerState(session, question, now = Date.now()) {
	const limit = Math.max(1, Number(question?.time_limit_seconds) || 20);
	if (!question || session?.status !== 'question') {
		return { remainingSeconds: 0, timedOut: false, countdownMs: 0 };
	}

	const clockNow = sessionNowMs(session, now);
	const preStartMs = questionPreStartMs(session, now);
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

	if (preStartMs > 0) {
		return { remainingSeconds: limit, timedOut: false, countdownMs };
	}

	const started = session?.question_started_at ? Date.parse(session.question_started_at) : 0;
	const endsAt = session?.question_ends_at
		? Date.parse(session.question_ends_at)
		: (Number.isFinite(started) && started > 0 ? started + limit * 1000 : null);

	if (!Number.isFinite(endsAt) || !endsAt) {
		return { remainingSeconds: limit, timedOut: false, countdownMs: 0 };
	}

	const origin = Number.isFinite(started) && started > 0 ? Math.max(clockNow, started) : clockNow;
	const left = Math.max(0, Math.ceil((endsAt - origin) / 1000));
	return { remainingSeconds: left, timedOut: left <= 0, countdownMs: 0 };
}
