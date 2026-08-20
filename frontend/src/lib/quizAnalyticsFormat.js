export function formatResponseMs(ms) {
	if (ms == null || ms === '' || !Number.isFinite(Number(ms))) return '—';
	return `${(Number(ms) / 1000).toFixed(1)}s`;
}

export function formatAccuracy(ratio) {
	if (ratio == null || !Number.isFinite(Number(ratio))) return '0%';
	return `${Math.round(Number(ratio) * 100)}%`;
}

export function formatScore(score) {
	const n = Number(score);
	return (Number.isFinite(n) ? n : 0).toLocaleString('en-US');
}

export function formatPointsDelta(amount) {
	const n = Number(amount);
	if (!Number.isFinite(n) || n === 0) return '0';
	if (n > 0) return `+${n.toLocaleString('en-US')}`;
	return n.toLocaleString('en-US');
}

export function powerUpLabel(type) {
	if (type === 'streak_freeze') return 'Streak Shield';
	if (type === 'double') return 'Double';
	if (type === 'bonus') return 'Bonus';
	if (type === 'eraser') return 'Eraser';
	return type || 'Power-up';
}

export function questionOutcome(row) {
	if (!row) return 'missed';
	if (row.result === 'correct' || row.result === 'wrong' || row.result === 'missed') {
		return row.result;
	}
	if (row.quiz_option_id == null) return 'missed';
	if (row.is_correct) return 'correct';
	return 'wrong';
}

export function questionOutcomeMark(outcome) {
	if (outcome === 'correct') return '✓';
	if (outcome === 'wrong') return '✕';
	return '⏱';
}

export function formatDifficulty(band) {
	if (band === 'easy') return 'EASY';
	if (band === 'medium') return 'MEDIUM';
	if (band === 'hard') return 'HARD';
	return '—';
}

export function formatExpEarned(amount, status) {
	const n = Number(amount);
	if (!Number.isFinite(n) || n <= 0) return null;
	if (status === 'pending') return `+${n} EXP pending`;
	return `+${n} EXP`;
}
