import { format, formatDistanceToNow } from 'date-fns';

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
	if (type === 'streak_freeze') return 'Shield';
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

export function formatQuizCreatedAt(value) {
	if (!value) return null;
	const date = new Date(value);
	if (!Number.isFinite(date.getTime())) return null;
	return format(date, 'd MMM yyyy');
}

export function formatQuizEditedAt(value) {
	if (!value) return null;
	const date = new Date(value);
	if (!Number.isFinite(date.getTime())) return null;
	return formatDistanceToNow(date, { addSuffix: true });
}

export function formatQuizOwnerMeta(createdAt, updatedAt) {
	const created = formatQuizCreatedAt(createdAt);
	const edited = formatQuizEditedAt(updatedAt);
	if (created && edited) return `Created ${created} · Edited ${edited}`;
	if (created) return `Created ${created}`;
	if (edited) return `Edited ${edited}`;
	return '';
}

export function formatLiveSessionWhen(value) {
	if (!value) return 'Live session';
	const date = new Date(value);
	if (!Number.isFinite(date.getTime())) return 'Live session';
	return format(date, 'd MMM yyyy · h:mm a');
}

export function formatSelfPacedDeadline(value) {
	if (!value) return null;
	const date = new Date(value);
	if (!Number.isFinite(date.getTime())) return null;
	return format(date, 'd MMM yyyy, h:mm a');
}

export function isSelfPacedDeadlinePassed(value, now = Date.now()) {
	if (!value) return false;
	const date = new Date(value);
	if (!Number.isFinite(date.getTime())) return false;
	return date.getTime() <= now;
}
