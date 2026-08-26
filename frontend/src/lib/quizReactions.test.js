import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
	QUIZ_REACTIONS,
	REACTION_META,
	consumeReactionAnimation,
	finishedReactionKey,
	getOrCreateReaction,
	getQuizReaction,
	pickQuizReactionCategory,
	pickStableLine,
	quizReactionCount,
	reactionEventKey,
	reactionLabel,
	reactionMetric,
	resetReactionGates,
} from './quizReactions.js';

afterEach(() => {
	resetReactionGates();
});

function baseAnswer(overrides = {}) {
	return {
		is_correct: true,
		quiz_option_id: 1,
		response_ms: 4000,
		streak_after: 1,
		rank: 2,
		previous_rank: 2,
		rank_delta: 0,
		...overrides,
	};
}

test('ships about 30 messages across categories', () => {
	const count = quizReactionCount();
	assert.equal(count, 30);
	for (const [category, lines] of Object.entries(QUIZ_REACTIONS)) {
		assert.ok(lines.length > 0, `${category} should have at least one line`);
		for (const line of lines) {
			assert.ok(line.length > 0 && line.length <= 52, `"${line}" is too long for mobile`);
		}
	}
});

test('correct_fast uses the 50% threshold and fast flag', () => {
	assert.equal(pickQuizReactionCategory({
		result_context: { correct: true, fast: true, missed: false },
		my_answer: baseAnswer({ response_ms: 2000 }),
		time_limit_seconds: 20,
	}), 'correct_fast');
});

test('correct_slow when correct but not fast', () => {
	assert.equal(pickQuizReactionCategory({
		result_context: { correct: true, fast: false, missed: false },
		my_answer: baseAnswer({ response_ms: 16000 }),
		time_limit_seconds: 20,
	}), 'correct_slow');
});

test('wrong_fast derives the same 50% threshold', () => {
	assert.equal(pickQuizReactionCategory({
		result_context: { correct: false, fast: false, missed: false },
		my_answer: baseAnswer({ is_correct: false, response_ms: 3000 }),
		time_limit_seconds: 20,
	}), 'wrong_fast');
});

test('wrong_slow when a wrong answer is after the midpoint', () => {
	assert.equal(pickQuizReactionCategory({
		result_context: { correct: false, missed: false },
		my_answer: baseAnswer({ is_correct: false, response_ms: 15000 }),
		time_limit_seconds: 20,
	}), 'wrong_slow');
});

test('missed / timeout', () => {
	assert.equal(pickQuizReactionCategory({
		result_context: { correct: false, missed: true },
		my_answer: { quiz_option_id: null, is_correct: false, streak_after: 0, rank_delta: 0 },
	}), 'missed');
});

test('streak >= 3 selects streak_3', () => {
	assert.equal(pickQuizReactionCategory({
		result_context: { correct: true, fast: true, streak: true, missed: false },
		my_answer: baseAnswer({ streak_after: 3, response_ms: 500 }),
		time_limit_seconds: 20,
	}), 'streak_3');
});

test('streak >= 5 selects streak_5 over streak_3', () => {
	assert.equal(pickQuizReactionCategory({
		result_context: { correct: true, fast: true, streak: true, missed: false },
		my_answer: baseAnswer({ streak_after: 5, response_ms: 500 }),
		time_limit_seconds: 20,
	}), 'streak_5');
});

test('rank up', () => {
	assert.equal(pickQuizReactionCategory({
		result_context: { correct: true, rank_up: true, rank_down: false, big_jump: false, missed: false },
		my_answer: baseAnswer({ rank: 3, previous_rank: 5, rank_delta: 2 }),
		player_count: 8,
	}), 'rank_up');
});

test('rank down', () => {
	assert.equal(pickQuizReactionCategory({
		result_context: { correct: false, rank_up: false, rank_down: true, missed: false },
		my_answer: baseAnswer({ is_correct: false, rank: 6, previous_rank: 4, rank_delta: -2, response_ms: 2000 }),
		player_count: 8,
	}), 'rank_down');
});

test('big jump beats streak and speed', () => {
	assert.equal(pickQuizReactionCategory({
		status: 'reveal',
		result_context: { correct: true, fast: true, streak: true, rank_up: true, big_jump: true, missed: false },
		my_answer: baseAnswer({
			streak_after: 5,
			rank: 2,
			previous_rank: 5,
			rank_delta: 3,
			response_ms: 400,
		}),
		player_count: 10,
		time_limit_seconds: 20,
	}), 'big_jump');
});

test('winner requires finished status and rank 1', () => {
	const shared = {
		result_context: { correct: true, fast: true, big_jump: true, missed: false },
		my_answer: baseAnswer({ rank: 1, previous_rank: 4, rank_delta: 3, streak_after: 5 }),
		player_count: 6,
	};
	assert.equal(pickQuizReactionCategory({ ...shared, status: 'leaderboard' }), 'big_jump');
	assert.equal(pickQuizReactionCategory({ ...shared, status: 'finished' }), 'winner');
	assert.equal(getQuizReaction({ ...shared, status: 'finished' }).category, 'winner');
});

test('finished non-winner does not get a reaction', () => {
	assert.equal(getQuizReaction({
		status: 'finished',
		my_answer: baseAnswer({ rank: 3, is_correct: true }),
		result_context: { correct: true, missed: false },
	}), null);
});

test('generic correct fallback when timing is unavailable', () => {
	assert.equal(pickQuizReactionCategory({
		result_context: { correct: true, missed: false },
		my_answer: baseAnswer({ response_ms: null }),
	}), 'correct');
});

test('generic wrong fallback when timing is unavailable', () => {
	assert.equal(pickQuizReactionCategory({
		result_context: { correct: false, missed: false },
		my_answer: baseAnswer({ is_correct: false, response_ms: null }),
	}), 'wrong');
});

test('fallback when no context exists', () => {
	assert.equal(pickQuizReactionCategory({}), 'fallback');
	assert.equal(getQuizReaction({}).category, 'fallback');
});

test('solo games skip rank reactions', () => {
	assert.equal(pickQuizReactionCategory({
		result_context: { correct: true, rank_up: true, big_jump: true, missed: false, fast: true },
		my_answer: baseAnswer({ rank: 1, previous_rank: 1, rank_delta: 3, streak_after: 1 }),
		player_count: 1,
		time_limit_seconds: 20,
	}), 'correct_fast');
});

test('same session/question/category is stable', () => {
	const input = {
		session_id: 42,
		question_id: 17,
		result_context: { correct: true, fast: true, missed: false },
		my_answer: baseAnswer({ response_ms: 800 }),
		time_limit_seconds: 20,
	};
	const first = getQuizReaction(input);
	const second = getQuizReaction(input);
	assert.equal(first.category, 'correct_fast');
	assert.equal(first.text, second.text);
	assert.equal(
		pickStableLine(QUIZ_REACTIONS.correct_fast, '42:17:correct_fast'),
		first.text,
	);
});

test('getOrCreateReaction freezes the first selection for a key', () => {
	const key = reactionEventKey(42, 17);
	const first = getOrCreateReaction(key, {
		session_id: 42,
		question_id: 17,
		result_context: { correct: true, fast: true, missed: false },
		my_answer: baseAnswer({ response_ms: 100 }),
		time_limit_seconds: 20,
	});
	const second = getOrCreateReaction(key, {
		session_id: 42,
		question_id: 17,
		result_context: { correct: false, missed: true },
		my_answer: { quiz_option_id: null, is_correct: false },
	});
	assert.equal(second, first);
	assert.equal(first.category, 'correct_fast');
});

test('finished reaction uses a separate event key', () => {
	assert.equal(reactionEventKey(9, 4), '9:4:result');
	assert.equal(finishedReactionKey(9), '9:finished');
});

test('reaction animation consumes once per key', () => {
	assert.equal(consumeReactionAnimation('a:1:result'), true);
	assert.equal(consumeReactionAnimation('a:1:result'), false);
});

test('display labels are polished, not internal ids', () => {
	assert.equal(reactionLabel('winner'), 'CHAMPION');
	assert.equal(reactionLabel('big_jump'), 'HUGE CLIMB');
	assert.equal(reactionLabel('streak_5'), 'UNSTOPPABLE');
	assert.equal(reactionLabel('streak_3'), 'ON A ROLL');
	assert.equal(reactionLabel('rank_up'), 'CLIMBING');
	assert.equal(reactionLabel('rank_down'), 'SLIPPED');
	assert.equal(reactionLabel('correct_fast'), 'LIGHTNING ROUND');
	assert.equal(reactionLabel('correct_slow'), 'CAREFUL HIT');
	assert.equal(reactionLabel('wrong_fast'), 'QUICK GUESS');
	assert.equal(reactionLabel('wrong_slow'), 'CLOSE CALL');
	assert.equal(reactionLabel('missed'), 'TIME OUT');
	assert.equal(reactionLabel('correct'), 'CORRECT');
	assert.equal(reactionLabel('wrong'), 'NOT THIS TIME');
	assert.equal(reactionLabel('fallback'), 'NEXT UP');
	assert.equal(Object.keys(REACTION_META).length, Object.keys(QUIZ_REACTIONS).length);
});

test('metrics only appear when the data exists', () => {
	assert.equal(reactionMetric('winner', { rank: 1 }), '#1');
	assert.equal(reactionMetric('big_jump', { rank: 3, previous_rank: 7 }), '#7 → #3');
	assert.equal(reactionMetric('rank_up', { rank: 4, previous_rank: 5 }), '#5 → #4');
	assert.equal(reactionMetric('streak_5', { streak_after: 5 }), '5 CORRECT IN A ROW');
	assert.equal(reactionMetric('correct_fast', { points_awarded: 980 }), '+980');
	assert.equal(reactionMetric('wrong', { points_awarded: 0, rank: 4 }), null);
	assert.equal(reactionMetric('wrong', { points_awarded: -800 }), '-800');
	assert.notEqual(reactionMetric('wrong', { points_awarded: -800 }), '-1600');
	assert.equal(reactionMetric('missed', { quiz_option_id: null }), null);
	assert.equal(reactionMetric('correct_fast', {}), null);
});

test('winner overrides everything else', () => {
	assert.equal(pickQuizReactionCategory({
		status: 'finished',
		result_context: { correct: true, fast: true, streak: true, rank_up: true, big_jump: true, missed: false },
		my_answer: baseAnswer({ rank: 1, previous_rank: 8, rank_delta: 7, streak_after: 5, response_ms: 200 }),
		player_count: 10,
	}), 'winner');
});

test('big_jump overrides streak_3', () => {
	assert.equal(pickQuizReactionCategory({
		result_context: { correct: true, streak: true, big_jump: true, missed: false },
		my_answer: baseAnswer({ streak_after: 3, rank: 2, previous_rank: 6, rank_delta: 4 }),
		player_count: 8,
	}), 'big_jump');
});

test('streak overrides rank movement', () => {
	assert.equal(pickQuizReactionCategory({
		result_context: { correct: true, rank_up: true, big_jump: false, missed: false },
		my_answer: baseAnswer({ streak_after: 4, rank: 3, previous_rank: 4, rank_delta: 1 }),
		player_count: 8,
	}), 'streak_3');
});

test('rank overrides speed', () => {
	assert.equal(pickQuizReactionCategory({
		result_context: { correct: true, fast: true, rank_up: true, big_jump: false, missed: false },
		my_answer: baseAnswer({ streak_after: 1, rank: 3, previous_rank: 5, rank_delta: 2, response_ms: 200 }),
		player_count: 8,
		time_limit_seconds: 20,
	}), 'rank_up');
});

test('speed overrides generic correct/wrong', () => {
	assert.equal(pickQuizReactionCategory({
		result_context: { correct: true, fast: true, missed: false },
		my_answer: baseAnswer({ streak_after: 1, rank_delta: 0, response_ms: 400, points_awarded: 980 }),
		time_limit_seconds: 20,
	}), 'correct_fast');
});

test('generic overrides fallback when the answer is known', () => {
	assert.equal(pickQuizReactionCategory({
		result_context: { correct: true, missed: false },
		my_answer: baseAnswer({ response_ms: null, rank_delta: 0, streak_after: 1 }),
	}), 'correct');
});

test('Q1 with rank_delta 0 does not invent a rank reaction', () => {
	assert.equal(pickQuizReactionCategory({
		result_context: { correct: true, fast: true, rank_up: false, rank_down: false, big_jump: false, missed: false },
		my_answer: baseAnswer({ rank: 1, previous_rank: 1, rank_delta: 0, streak_after: 1, response_ms: 800 }),
		player_count: 6,
		time_limit_seconds: 20,
	}), 'correct_fast');
});

test('first place before the game finishes is not champion', () => {
	assert.equal(pickQuizReactionCategory({
		status: 'reveal',
		result_context: { correct: true, fast: true, missed: false },
		my_answer: baseAnswer({ rank: 1, previous_rank: 1, rank_delta: 0, streak_after: 1 }),
		player_count: 6,
		time_limit_seconds: 20,
	}), 'correct_fast');
});

test('missing result_context still classifies from my_answer', () => {
	assert.equal(pickQuizReactionCategory({
		my_answer: baseAnswer({ is_correct: false, quiz_option_id: 2, response_ms: 12000 }),
		time_limit_seconds: 20,
	}), 'wrong_slow');
});

test('different question IDs can produce different messages', () => {
	const shared = {
		session_id: 8,
		result_context: { correct: true, fast: true, missed: false },
		my_answer: baseAnswer({ response_ms: 500, points_awarded: 900 }),
		time_limit_seconds: 20,
	};
	const a = getQuizReaction({ ...shared, question_id: 1 });
	const b = getQuizReaction({ ...shared, question_id: 2 });
	assert.equal(a.category, 'correct_fast');
	assert.equal(b.category, 'correct_fast');
	assert.ok(QUIZ_REACTIONS.correct_fast.includes(a.text));
	assert.ok(QUIZ_REACTIONS.correct_fast.includes(b.text));
});

test('getQuizReaction includes label and metric', () => {
	const reaction = getQuizReaction({
		session_id: 1,
		question_id: 2,
		result_context: { correct: true, fast: true, missed: false },
		my_answer: baseAnswer({ response_ms: 400, points_awarded: 980 }),
		time_limit_seconds: 20,
	});
	assert.equal(reaction.label, 'LIGHTNING ROUND');
	assert.equal(reaction.metric, '+980');
});

test('published solo play skips rank reactions and still scores fast/miss', () => {
	assert.equal(pickQuizReactionCategory({
		player_count: 1,
		my_answer: baseAnswer({
			rank: 1,
			rank_delta: 4,
			response_ms: 3000,
			streak_after: 1,
		}),
		time_limit_seconds: 20,
	}), 'correct_fast');
	assert.equal(pickQuizReactionCategory({
		player_count: 1,
		my_answer: baseAnswer({
			is_correct: false,
			response_ms: 16000,
			streak_after: 0,
		}),
		time_limit_seconds: 20,
	}), 'wrong_slow');
	assert.equal(pickQuizReactionCategory({
		player_count: 1,
		my_answer: { quiz_option_id: null, is_correct: false, points_awarded: 0 },
	}), 'missed');
});
