import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	answerGridClass,
	isSelectedQuizOption,
	isTrueFalseQuestion,
	trueFalseOptions,
	QUIZ_AVATAR_RING_CLASS,
	QUIZ_GOLD_OUTLINE_CLASS,
} from './quizQuestion.js';
import {
	attachSessionClock,
	isQuizAnsweringOpen,
	questionTimerState,
	quizCountdownLabel,
	quizCountdownRemainingMs,
	sessionNowMs,
} from './quizCountdown.js';
import { formatDifficulty, formatExpEarned } from './quizAnalyticsFormat.js';
import { isPowerUpVisibleForQuestion, scoringPowerUpBlocked } from './quizPowerUps.js';

test('true/false options are locked True/False labels', () => {
	assert.deepEqual(trueFalseOptions(true), [
		{ label: 'True', is_correct: true },
		{ label: 'False', is_correct: false },
	]);
	assert.deepEqual(trueFalseOptions(false), [
		{ label: 'True', is_correct: false },
		{ label: 'False', is_correct: true },
	]);
	assert.equal(isTrueFalseQuestion({ question_type: 'true_false', options: trueFalseOptions() }), true);
	assert.equal(isTrueFalseQuestion({ question_type: 'multiple_choice', options: [{}, {}, {}, {}] }), false);
	assert.equal(isPowerUpVisibleForQuestion('eraser', { question_type: 'true_false', options: trueFalseOptions() }), false);
	assert.equal(isPowerUpVisibleForQuestion('double', { question_type: 'true_false', options: trueFalseOptions() }), true);
	assert.equal(isPowerUpVisibleForQuestion('bonus', { question_type: 'true_false', options: trueFalseOptions() }), true);
	assert.equal(scoringPowerUpBlocked('bonus', [{ type: 'double', active: true }]), true);
	assert.equal(answerGridClass({ question_type: 'true_false' }), 'grid grid-cols-2 gap-3');
	assert.equal(answerGridClass({ question_type: 'multiple_choice' }), 'grid grid-cols-2 lg:grid-cols-1 gap-3');
});

test('chart gold outline is player selection only; host and missed have none', () => {
	const options = [
		{ id: 1, is_correct: false },
		{ id: 2, is_correct: false },
		{ id: 3, is_correct: true },
		{ id: 4, is_correct: false },
	];

	const barsFor = (selectedOptionId) => options.map((opt) => ({
		id: opt.id,
		selected: isSelectedQuizOption(opt.id, selectedOptionId),
		isCorrect: !!opt.is_correct,
	}));

	const wrongPick = barsFor(2);
	assert.equal(wrongPick.filter((b) => b.selected).length, 1);
	assert.equal(wrongPick.find((b) => b.id === 2).selected, true);
	assert.equal(wrongPick.find((b) => b.id === 2).isCorrect, false);
	assert.equal(wrongPick.find((b) => b.id === 3).selected, false);
	assert.equal(wrongPick.find((b) => b.id === 3).isCorrect, true);

	const correctPick = barsFor(3);
	assert.equal(correctPick.find((b) => b.id === 3).selected, true);
	assert.equal(correctPick.find((b) => b.id === 3).isCorrect, true);

	const missed = barsFor(null);
	assert.equal(missed.every((b) => b.selected === false), true);
	assert.equal(missed.find((b) => b.id === 3).isCorrect, true);

	const host = barsFor(undefined);
	assert.equal(host.every((b) => b.selected === false), true);
	assert.equal(options.length, 4);
	assert.match(QUIZ_GOLD_OUTLINE_CLASS, /outline-\[#D89E00\]/);
	assert.match(QUIZ_GOLD_OUTLINE_CLASS, /outline /);
});

test('difficulty band formatter', () => {
	assert.equal(formatDifficulty('easy'), 'EASY');
	assert.equal(formatDifficulty('medium'), 'MEDIUM');
	assert.equal(formatDifficulty('hard'), 'HARD');
	assert.equal(formatDifficulty(null), '—');
});

test('EXP reward formatter', () => {
	assert.equal(formatExpEarned(20), '+20 EXP');
	assert.equal(formatExpEarned(15), '+15 EXP');
	assert.equal(formatExpEarned(20, 'pending'), '+20 EXP pending');
	assert.equal(formatExpEarned(20, 'claimed'), '+20 EXP');
	assert.equal(formatExpEarned(0), null);
	assert.equal(formatExpEarned(null), null);
});

test('countdown state is Q1-only and does not steal answering time', () => {
	const started = Date.parse('2026-08-20T03:00:03.000Z');
	const now = Date.parse('2026-08-20T03:00:01.000Z');
	const session = {
		status: 'question',
		paused: false,
		answering_open: false,
		quiz: { current_question_number: 1 },
		question_started_at: '2026-08-20T03:00:03.000Z',
		question_ends_at: '2026-08-20T03:00:23.000Z',
	};
	assert.equal(quizCountdownRemainingMs(session, now), started - now);
	assert.equal(quizCountdownLabel(2500), '3');
	assert.equal(quizCountdownLabel(1500), '2');
	assert.equal(quizCountdownLabel(800), '1');
	assert.equal(quizCountdownLabel(200), 'GO!');
	assert.equal(isQuizAnsweringOpen(session, now), false);

	const afterGo = Date.parse('2026-08-20T03:00:03.000Z');
	const staleClosed = { ...session, answering_open: false };
	assert.equal(quizCountdownRemainingMs(staleClosed, afterGo), 0);
	assert.equal(isQuizAnsweringOpen(staleClosed, afterGo), true);

	const openSession = { ...session, answering_open: true };
	assert.equal(quizCountdownRemainingMs(openSession, afterGo), 0);
	assert.equal(quizCountdownLabel(0), null);
	assert.equal(isQuizAnsweringOpen(openSession, afterGo), true);

	const timer = questionTimerState(session, { time_limit_seconds: 20 }, now);
	assert.equal(timer.remainingSeconds, 20);
	assert.equal(timer.timedOut, false);
	assert.ok(timer.countdownMs > 0);

	const atGo = questionTimerState(staleClosed, { time_limit_seconds: 20 }, afterGo);
	assert.equal(atGo.remainingSeconds, 20);
	assert.equal(atGo.countdownMs, 0);
	assert.equal(atGo.timedOut, false);

	const laterQuestion = questionTimerState(
		{
			...openSession,
			quiz: { current_question_number: 2 },
			question_started_at: '2026-08-20T03:01:00.000Z',
			question_ends_at: '2026-08-20T03:01:20.000Z',
		},
		{ time_limit_seconds: 20 },
		Date.parse('2026-08-20T03:01:05.000Z'),
	);
	assert.equal(laterQuestion.remainingSeconds, 15);
	assert.equal(laterQuestion.countdownMs, 0);
	assert.equal(laterQuestion.timedOut, false);
});

test('later questions do not show 3-2-1 and keep a full answering window', () => {
	const now = Date.parse('2026-08-20T03:01:00.000Z');
	const session = {
		status: 'question',
		paused: false,
		answering_open: false,
		quiz: { current_question_number: 2 },
		question_started_at: '2026-08-20T03:01:02.000Z',
		question_ends_at: '2026-08-20T03:01:27.000Z',
	};
	assert.equal(quizCountdownRemainingMs(session, now), 0);
	assert.equal(quizCountdownLabel(quizCountdownRemainingMs(session, now)), null);
	assert.equal(isQuizAnsweringOpen(session, now), false);
	const waiting = questionTimerState(session, { time_limit_seconds: 25 }, now);
	assert.equal(waiting.remainingSeconds, 25);
	assert.equal(waiting.countdownMs, 0);

	const openAt = Date.parse('2026-08-20T03:01:02.000Z');
	const open = questionTimerState(session, { time_limit_seconds: 25 }, openAt);
	assert.equal(open.remainingSeconds, 25);
	assert.equal(open.countdownMs, 0);
	assert.equal(isQuizAnsweringOpen({ ...session, answering_open: true }, openAt), true);
});

test('question timer follows server clock so a fast client still sees the full window', () => {
	const serverNow = Date.parse('2026-08-20T03:00:00.000Z');
	const clientNow = serverNow + 7000;
	const session = attachSessionClock({
		status: 'question',
		paused: false,
		answering_open: true,
		question_started_at: '2026-08-20T03:00:00.000Z',
		question_ends_at: '2026-08-20T03:00:25.000Z',
		server_now: '2026-08-20T03:00:00.000Z',
		remaining_question_ms: 25000,
	}, clientNow);
	assert.equal(sessionNowMs(session, clientNow), serverNow);
	const timer = questionTimerState(session, { time_limit_seconds: 25 }, clientNow);
	assert.equal(timer.remainingSeconds, 25);
	assert.equal(timer.countdownMs, 0);
	assert.equal(timer.timedOut, false);
});

test('held published payload still shows a full answering window', () => {
	const postedAt = Date.parse('2026-08-20T03:00:00.000Z');
	const shownAt = postedAt + 2000;
	const session = attachSessionClock({
		status: 'question',
		paused: false,
		answering_open: false,
		quiz: { current_question_number: 2 },
		question_started_at: '2026-08-20T03:00:02.000Z',
		question_ends_at: '2026-08-20T03:00:27.000Z',
		server_now: '2026-08-20T03:00:00.000Z',
		remaining_question_ms: 27000,
	}, postedAt, { overwrite: true });
	const timer = questionTimerState(session, { time_limit_seconds: 25 }, shownAt);
	assert.equal(timer.countdownMs, 0);
	assert.equal(timer.remainingSeconds, 25);
	assert.equal(timer.timedOut, false);
});

test('quiz avatar gold ring helper', () => {
	assert.match(QUIZ_AVATAR_RING_CLASS, /ring-\[#D89E00\]/);
});
