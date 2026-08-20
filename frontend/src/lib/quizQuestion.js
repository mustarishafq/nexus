export const QUIZ_GOLD = '#D89E00';

export const QUIZ_AVATAR_RING_CLASS = 'ring-[3px] ring-[#D89E00]';

export function isTrueFalseQuestion(question) {
	const type = question?.question_type || question?.type;
	if (type === 'true_false') return true;
	const options = question?.options;
	return Array.isArray(options) && options.length === 2 && type === 'true_false';
}

export function trueFalseOptions(trueIsCorrect = true) {
	return [
		{ label: 'True', is_correct: !!trueIsCorrect },
		{ label: 'False', is_correct: !trueIsCorrect },
	];
}

export function answerGridClass(question) {
	if (isTrueFalseQuestion(question)) {
		return 'grid grid-cols-1 sm:grid-cols-2 gap-3';
	}
	return 'grid gap-3';
}

export const QUIZ_GOLD_OUTLINE_CLASS = 'outline outline-4 outline-offset-2 outline-[#D89E00]';

export function isSelectedQuizOption(optionId, selectedOptionId) {
	if (selectedOptionId == null || selectedOptionId === '') return false;
	return Number(optionId) === Number(selectedOptionId);
}
