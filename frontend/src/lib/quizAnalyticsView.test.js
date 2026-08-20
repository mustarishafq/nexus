import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatAccuracy, formatResponseMs, formatScore, questionOutcome, questionOutcomeMark } from './quizAnalyticsFormat.js';
import {
	analyticsHeadline,
	hostTableCells,
	powerUpStatus,
	rankChangeLabel,
	visiblePlayers,
} from './quizAnalyticsView.js';

test('host and player headlines differ', () => {
	assert.equal(analyticsHeadline(true), 'Game report');
	assert.equal(analyticsHeadline(false), 'Your Quiz Performance');
});

test('host table cells format comparison rows', () => {
	const cells = hostTableCells({
		display_name: 'Sarah',
		score: 8420,
		accuracy: 0.9,
		correct: 9,
		wrong: 1,
		missed: 0,
		average_response_ms: 2400,
		best_streak: 5,
		power_ups_used: 3,
		power_ups_available: 4,
	});
	assert.equal(cells.name, 'Sarah');
	assert.equal(formatScore(cells.score), '8,420');
	assert.equal(formatAccuracy(cells.accuracy), '90%');
	assert.equal(cells.correct, 9);
	assert.equal(cells.wrong, 1);
	assert.equal(cells.missed, 0);
	assert.equal(formatResponseMs(cells.average_response_ms), '2.4s');
	assert.equal(cells.best_streak, 5);
	assert.equal(cells.powerUps, '3/4');
});

test('empty host table and player cards stay safe', () => {
	assert.deepEqual(hostTableCells({}), {
		name: '—',
		score: 0,
		accuracy: 0,
		correct: 0,
		wrong: 0,
		missed: 0,
		average_response_ms: null,
		best_streak: 0,
		powerUps: '0/0',
	});
	assert.equal(formatResponseMs(null), '—');
	assert.equal(formatAccuracy(0), '0%');
	assert.equal(rankChangeLabel(0), 'No change');
	assert.equal(rankChangeLabel(2), '↑ 2');
	assert.equal(rankChangeLabel(-1), '↓ 1');
});

test('question breakdown maps correct wrong missed', () => {
	assert.equal(questionOutcome({ result: 'correct' }), 'correct');
	assert.equal(questionOutcome({ result: 'wrong' }), 'wrong');
	assert.equal(questionOutcome({ result: 'missed' }), 'missed');
	assert.equal(questionOutcomeMark('correct'), '✓');
	assert.equal(questionOutcomeMark('wrong'), '✕');
	assert.equal(questionOutcomeMark('missed'), '⏱');
});

test('player view hides other players while host sees the table', () => {
	const host = { viewer: { is_host: true }, players: [{ user_id: 1 }, { user_id: 2 }] };
	const player = { viewer: { is_host: false }, players: [], me: { user_id: 1 } };
	assert.equal(visiblePlayers(host).length, 2);
	assert.equal(visiblePlayers(player).length, 0);
	assert.deepEqual(powerUpStatus({ activated: true, recorded_on_correct: true }), {
		usedLabel: 'Used',
		effectLabel: 'Applied on a correct answer',
	});
	assert.deepEqual(powerUpStatus({ activated: false, recorded_on_correct: false }), {
		usedLabel: 'Not used',
		effectLabel: null,
	});
});
