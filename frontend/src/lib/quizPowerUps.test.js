import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isTrueFalseQuestion } from './quizQuestion.js';
import {
	QUIZ_BONUS_POINTS,
	answerFeedbackText,
	isPowerUpVisibleForQuestion,
	isScoringPowerUp,
	powerUpArmedHint,
	powerUpHint,
	scoringPowerUpBlocked,
} from './quizPowerUps.js';
import { formatPointsDelta } from './quizAnalyticsFormat.js';

test('bonus copy is a flat +500 if correct', () => {
	assert.equal(QUIZ_BONUS_POINTS, 500);
	assert.equal(powerUpHint('bonus'), '+500 if correct');
	assert.equal(powerUpArmedHint('bonus'), '+500 if correct');
	assert.match(powerUpHint('bonus'), /\+500/);
	assert.ok(powerUpHint('bonus').length <= 24);
});

test('double copy is risk/reward, not a free 2×', () => {
	assert.match(powerUpHint('double'), /2×/);
	assert.match(powerUpHint('double'), /lose points if wrong/);
	assert.doesNotMatch(powerUpHint('double'), /2× this question/);
	assert.match(powerUpArmedHint('double'), /lose if wrong/);
	assert.ok(powerUpHint('double').length <= 48);
	assert.ok(powerUpArmedHint('double').length <= 24);
});

test('double and bonus are mutually exclusive in the UI', () => {
	const inventory = [
		{ type: 'double', active: true },
		{ type: 'bonus', active: false },
		{ type: 'streak_freeze', active: false },
	];
	assert.equal(isScoringPowerUp('double'), true);
	assert.equal(isScoringPowerUp('bonus'), true);
	assert.equal(isScoringPowerUp('streak_freeze'), false);
	assert.equal(scoringPowerUpBlocked('bonus', inventory), true);
	assert.equal(scoringPowerUpBlocked('double', inventory), false);
	assert.equal(scoringPowerUpBlocked('streak_freeze', inventory), false);
	assert.equal(scoringPowerUpBlocked('bonus', null), false);
	assert.equal(scoringPowerUpBlocked('double', undefined), false);

	const bonusArmed = [{ type: 'bonus', active: true }, { type: 'double', active: false }];
	assert.equal(scoringPowerUpBlocked('double', bonusArmed), true);
	assert.equal(scoringPowerUpBlocked('bonus', bonusArmed), false);
});

test('true/false still hides eraser and keeps other power-ups', () => {
	const tf = { question_type: 'true_false', options: [{}, {}] };
	assert.equal(isTrueFalseQuestion(tf), true);
	assert.equal(isPowerUpVisibleForQuestion('eraser', tf), false);
	assert.equal(isPowerUpVisibleForQuestion('double', tf), true);
	assert.equal(isPowerUpVisibleForQuestion('bonus', tf), true);
	assert.equal(isPowerUpVisibleForQuestion('streak_freeze', tf), true);
	assert.equal(isPowerUpVisibleForQuestion('eraser', { question_type: 'multiple_choice' }), true);
});

test('power-up button copy stays short enough for mobile wrap', () => {
	for (const type of ['eraser', 'double', 'streak_freeze', 'bonus']) {
		assert.ok(powerUpHint(type).length <= 48, `${type} hint too long`);
		assert.ok(powerUpArmedHint(type).length <= 24, `${type} armed hint too long`);
	}
});

test('bonus +500 and double signed deltas format without doubling the penalty', () => {
	assert.equal(formatPointsDelta(1500), '+1,500');
	assert.equal(formatPointsDelta(500), '+500');
	assert.equal(formatPointsDelta(-800), '-800');
	assert.equal(formatPointsDelta(-1600), '-1,600');
	assert.equal(formatPointsDelta(0), '0');
	assert.equal(answerFeedbackText(true, 1500), 'Correct! +1,500');
	assert.equal(answerFeedbackText(true, 2000), 'Correct! +2,000');
	assert.equal(answerFeedbackText(false, 0), 'Wrong');
	assert.equal(answerFeedbackText(false, -800), 'Wrong -800');
	assert.notEqual(answerFeedbackText(false, -800), 'Wrong -1600');
});
