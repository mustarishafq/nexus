import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	formatAccuracy,
	formatResponseMs,
	formatScore,
	formatPointsDelta,
	formatDifficulty,
	formatExpEarned,
	powerUpLabel,
	questionOutcome,
	questionOutcomeMark,
	formatQuizCreatedAt,
	formatQuizOwnerMeta,
	formatSelfPacedDeadline,
	isSelfPacedDeadlinePassed,
} from './quizAnalyticsFormat.js';

test('formats response times and empty states', () => {
	assert.equal(formatResponseMs(2400), '2.4s');
	assert.equal(formatResponseMs(null), '—');
	assert.equal(formatResponseMs(undefined), '—');
});

test('formats accuracy as a percent', () => {
	assert.equal(formatAccuracy(0.9), '90%');
	assert.equal(formatAccuracy(0), '0%');
	assert.equal(formatAccuracy(null), '0%');
});

test('formats difficulty bands', () => {
	assert.equal(formatDifficulty('easy'), 'EASY');
	assert.equal(formatDifficulty('medium'), 'MEDIUM');
	assert.equal(formatDifficulty('hard'), 'HARD');
	assert.equal(formatDifficulty(null), '—');
});

test('formats EXP earned', () => {
	assert.equal(formatExpEarned(20), '+20 EXP');
	assert.equal(formatExpEarned(20, 'pending'), '+20 EXP pending');
	assert.equal(formatExpEarned(20, 'claimed'), '+20 EXP');
	assert.equal(formatExpEarned(0), null);
});

test('formats quiz owner metadata', () => {
	assert.equal(formatQuizCreatedAt('2026-08-12T10:00:00.000Z').includes('Aug 2026'), true);
	assert.match(formatQuizOwnerMeta('2026-08-12T10:00:00.000Z', new Date().toISOString()), /Created .* · Edited /);
	assert.equal(formatQuizOwnerMeta(null, null), '');
});

test('question outcomes map to marks', () => {
	assert.equal(questionOutcome({ result: 'correct' }), 'correct');
	assert.equal(questionOutcome({ result: 'wrong' }), 'wrong');
	assert.equal(questionOutcome({ quiz_option_id: null, is_correct: false }), 'missed');
	assert.equal(questionOutcomeMark('correct'), '✓');
	assert.equal(questionOutcomeMark('wrong'), '✕');
	assert.equal(questionOutcomeMark('missed'), '⏱');
});

test('power-up labels stay user-facing', () => {
	assert.equal(powerUpLabel('streak_freeze'), 'Streak Shield');
	assert.equal(powerUpLabel('double'), 'Double');
	assert.equal(powerUpLabel('bonus'), 'Bonus');
	assert.equal(formatScore(8420), '8,420');
	assert.equal(formatScore(-800), '-800');
	assert.equal(formatPointsDelta(1500), '+1,500');
	assert.equal(formatPointsDelta(-800), '-800');
	assert.equal(formatPointsDelta(0), '0');
});

test('formats optional self-paced deadlines', () => {
	assert.equal(formatSelfPacedDeadline(null), null);
	assert.equal(isSelfPacedDeadlinePassed(null), false);
	assert.equal(isSelfPacedDeadlinePassed('2026-08-20T15:59:00.000Z', Date.parse('2026-08-20T15:58:00.000Z')), false);
	assert.equal(isSelfPacedDeadlinePassed('2026-08-20T15:59:00.000Z', Date.parse('2026-08-20T16:00:00.000Z')), true);
	assert.match(formatSelfPacedDeadline('2026-08-20T15:59:00.000Z'), /Aug 2026/);
});
