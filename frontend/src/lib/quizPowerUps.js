import { isTrueFalseQuestion } from './quizQuestion.js';
import { formatPointsDelta } from './quizAnalyticsFormat.js';

export const QUIZ_BONUS_POINTS = 500;
export const SCORING_POWER_UP_TYPES = ['double', 'bonus'];

export const POWER_UP_GUIDE = [
	{ type: 'eraser', label: 'Eraser', blurb: 'Removes 2 wrong answers.' },
	{ type: 'double', label: 'Double', blurb: '2× if correct. Lose points if wrong.' },
	{ type: 'streak_freeze', label: 'Shield', blurb: 'Keeps your streak if you miss.' },
	{ type: 'bonus', label: 'Bonus', blurb: '+500 extra if you get it right.' },
];

export function isScoringPowerUp(type) {
	return type === 'double' || type === 'bonus';
}

export function scoringPowerUpBlocked(type, inventory = []) {
	if (!isScoringPowerUp(type)) return false;
	const list = Array.isArray(inventory) ? inventory : [];
	return list.some((powerUp) => (
		powerUp.active && isScoringPowerUp(powerUp.type) && powerUp.type !== type
	));
}

export function isPowerUpVisibleForQuestion(type, question) {
	if (type === 'eraser' && isTrueFalseQuestion(question)) return false;
	return true;
}

export function powerUpHint(type) {
	if (type === 'double') return '2× if correct — lose points if wrong';
	if (type === 'bonus') return '+500 if correct';
	if (type === 'eraser') return 'Remove 2';
	if (type === 'streak_freeze') return 'Keep streak';
	return '';
}

export function powerUpArmedHint(type) {
	if (type === 'double') return '2× / lose if wrong';
	if (type === 'bonus') return '+500 if correct';
	if (type === 'eraser') return 'This question';
	if (type === 'streak_freeze') return 'This question';
	return '';
}

export function answerFeedbackText(isCorrect, points) {
	const delta = formatPointsDelta(points);
	if (isCorrect) return delta === '0' ? 'Correct!' : `Correct! ${delta}`;
	if (Number(points) < 0) return `Wrong ${delta}`;
	return 'Wrong';
}
