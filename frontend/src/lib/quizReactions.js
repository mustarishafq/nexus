const selectedByKey = new Map();
const animatedKeys = new Set();

export const QUIZ_REACTIONS = {
	winner: [
		'Take a bow — that’s first place.',
		'You ran the table. Well played.',
	],
	big_jump: [
		'Huge climb! The board noticed.',
		'What a surge — several spots in one go.',
	],
	streak_5: [
		'Five in a row. Unstoppable.',
		'Streak of 5. Keep the heat on.',
	],
	streak_3: [
		'Three straight. You’re in rhythm.',
		'Streak on. Don’t blink.',
	],
	rank_up: [
		'Up a few spots. Nice move.',
		'Climbing the board.',
	],
	rank_down: [
		'A slip — plenty of questions left.',
		'Board shuffled. You can climb back.',
	],
	correct_fast: [
		'Lightning round. Nailed it.',
		'Fast and right. Love that.',
		'Speed and accuracy. Yes.',
	],
	correct_slow: [
		'Took a beat. Still got it.',
		'Careful and correct. That counts.',
		'No rush. Right answer.',
	],
	wrong_fast: [
		'Quick trigger, wrong target.',
		'Fast guess — next one, slower maybe.',
	],
	wrong_slow: [
		'That one slipped. Shake it off.',
		'Close think, wrong pick. Next up.',
	],
	missed: [
		'Clock won that round.',
		'Time’s up — next question awaits.',
		'Missed the window. You’ll catch the next.',
	],
	correct: [
		'Correct. Bank those points.',
		'That’s a hit.',
	],
	wrong: [
		'Not this one. On to the next.',
		'Wrong answer, still in the game.',
	],
	fallback: [
		'On to the next one.',
	],
};

export const REACTION_META = {
	winner: { label: 'CHAMPION', theme: 'winner' },
	big_jump: { label: 'HUGE CLIMB', theme: 'big_jump' },
	streak_5: { label: 'UNSTOPPABLE', theme: 'streak' },
	streak_3: { label: 'ON A ROLL', theme: 'streak' },
	rank_up: { label: 'CLIMBING', theme: 'rank_up' },
	rank_down: { label: 'SLIPPED', theme: 'rank_down' },
	correct_fast: { label: 'LIGHTNING ROUND', theme: 'correct_fast' },
	correct_slow: { label: 'CAREFUL HIT', theme: 'correct_slow' },
	wrong_fast: { label: 'QUICK GUESS', theme: 'wrong_fast' },
	wrong_slow: { label: 'CLOSE CALL', theme: 'wrong_slow' },
	missed: { label: 'TIME OUT', theme: 'missed' },
	correct: { label: 'CORRECT', theme: 'correct' },
	wrong: { label: 'NOT THIS TIME', theme: 'wrong' },
	fallback: { label: 'NEXT UP', theme: 'fallback' },
};

export const REACTION_PRIORITY = [
	'winner',
	'big_jump',
	'streak_5',
	'streak_3',
	'rank_up',
	'rank_down',
	'correct_fast',
	'correct_slow',
	'wrong_fast',
	'wrong_slow',
	'missed',
	'correct',
	'wrong',
	'fallback',
];

export function reactionEventKey(sessionId, questionId) {
	return `${sessionId}:${questionId}:result`;
}

export function finishedReactionKey(sessionId) {
	return `${sessionId}:finished`;
}

export function quizReactionCount() {
	return Object.values(QUIZ_REACTIONS).reduce((sum, lines) => sum + lines.length, 0);
}

export function pickStableLine(lines, seed) {
	const list = Array.isArray(lines) && lines.length > 0 ? lines : QUIZ_REACTIONS.fallback;
	let hash = 0;
	const text = String(seed ?? '');
	for (let i = 0; i < text.length; i += 1) {
		hash = (hash << 5) - hash + text.charCodeAt(i);
		hash |= 0;
	}
	return list[Math.abs(hash) % list.length];
}

function isMissed(input) {
	const mine = input.my_answer || {};
	const ctx = input.result_context || {};
	if (ctx.missed === true) return true;
	if (Object.prototype.hasOwnProperty.call(mine, 'quiz_option_id')) {
		return mine.quiz_option_id == null;
	}
	return false;
}

function isCorrect(input, missed) {
	if (missed) return false;
	const mine = input.my_answer || {};
	const ctx = input.result_context || {};
	if (ctx.correct === true) return true;
	if (ctx.correct === false) return false;
	return mine.is_correct === true;
}

function responseMs(input) {
	const value = input.my_answer?.response_ms;
	if (value == null || value === '') return null;
	const ms = Number(value);
	return Number.isFinite(ms) ? ms : null;
}

function timeLimitMs(input) {
	const seconds = Number(input.time_limit_seconds);
	return Math.max(1, (Number.isFinite(seconds) && seconds > 0 ? seconds : 20) * 1000);
}

function isFastResponse(input, { ignoreContextFast = false } = {}) {
	const ctx = input.result_context || {};
	// Backend only sets `fast` for correct answers. Wrong answers always get false.
	if (!ignoreContextFast) {
		if (ctx.fast === true) return true;
		if (ctx.fast === false) return false;
	}
	const ms = responseMs(input);
	if (ms == null) return null;
	return ms <= Math.floor(timeLimitMs(input) * 0.5);
}

export function pickQuizReactionCategory(input = {}) {
	const mine = input.my_answer || {};
	const ctx = input.result_context || {};
	const rank = Number(mine.rank);
	const delta = Number(mine.rank_delta) || 0;
	const streak = Number(mine.streak_after) || 0;
	const playerCount = Number(input.player_count);
	const canRank = playerCount !== 1;
	const missed = isMissed(input);
	const correct = isCorrect(input, missed);
	const wrong = !missed && !correct && (ctx.correct === false || mine.is_correct === false || mine.quiz_option_id != null);

	if (input.status === 'finished' && rank === 1) {
		return 'winner';
	}

	if (canRank && (ctx.big_jump === true || delta >= 3)) {
		return 'big_jump';
	}

	if (streak >= 5) return 'streak_5';
	if (streak >= 3) return 'streak_3';

	if (canRank && delta > 0) return 'rank_up';
	if (canRank && delta < 0) return 'rank_down';

	if (correct) {
		const fast = isFastResponse(input);
		if (fast === true) return 'correct_fast';
		if (fast === false) return 'correct_slow';
		return 'correct';
	}

	if (wrong) {
		const fast = isFastResponse(input, { ignoreContextFast: true });
		if (fast === true) return 'wrong_fast';
		if (fast === false) return 'wrong_slow';
		return 'wrong';
	}

	if (missed) return 'missed';

	return 'fallback';
}

export function reactionLabel(category) {
	return REACTION_META[category]?.label || REACTION_META.fallback.label;
}

export function reactionTheme(category) {
	return REACTION_META[category]?.theme || 'fallback';
}

export function reactionMetric(category, myAnswer = {}) {
	const mine = myAnswer || {};
	const rank = mine.rank != null && mine.rank !== '' ? Number(mine.rank) : null;
	const previousRank = mine.previous_rank != null && mine.previous_rank !== '' ? Number(mine.previous_rank) : null;
	const points = mine.points_awarded != null && mine.points_awarded !== '' ? Number(mine.points_awarded) : null;
	const streak = Number(mine.streak_after) || 0;

	if (category === 'winner' && rank === 1) {
		return '#1';
	}

	if ((category === 'big_jump' || category === 'rank_up') && rank != null && previousRank != null) {
		return `#${previousRank} → #${rank}`;
	}

	if ((category === 'streak_5' || category === 'streak_3') && streak > 0) {
		return `${streak} CORRECT IN A ROW`;
	}

	if ((category === 'correct' || category === 'correct_fast' || category === 'correct_slow') && Number.isFinite(points) && points > 0) {
		return `+${points}`;
	}

	if ((category === 'wrong' || category === 'wrong_fast' || category === 'wrong_slow') && Number.isFinite(points) && points < 0) {
		return `${points}`;
	}

	return null;
}

export function getQuizReaction(input = {}) {
	if (input.status === 'finished' && Number(input.my_answer?.rank) !== 1) {
		return null;
	}

	const category = pickQuizReactionCategory(input);
	const lines = QUIZ_REACTIONS[category] || QUIZ_REACTIONS.fallback;
	const seed = `${input.session_id ?? ''}:${input.question_id ?? ''}:${category}`;
	return {
		category,
		text: pickStableLine(lines, seed),
		label: reactionLabel(category),
		metric: reactionMetric(category, input.my_answer),
	};
}

export function getOrCreateReaction(key, input) {
	if (key && selectedByKey.has(key)) {
		return selectedByKey.get(key);
	}
	const reaction = getQuizReaction(input);
	if (key) {
		selectedByKey.set(key, reaction);
	}
	return reaction;
}

export function consumeReactionAnimation(key) {
	if (!key || animatedKeys.has(key)) return false;
	animatedKeys.add(key);
	return true;
}

export function resetReactionGates() {
	selectedByKey.clear();
	animatedKeys.clear();
}
