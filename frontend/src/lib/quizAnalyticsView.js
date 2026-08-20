export function analyticsHeadline(isHost) {
	return isHost ? 'Game report' : 'Your Quiz Performance';
}

export function rankChangeLabel(delta) {
	const n = Number(delta) || 0;
	if (n === 0) return 'No change';
	return n > 0 ? `↑ ${n}` : `↓ ${Math.abs(n)}`;
}

export function powerUpStatus(pu) {
	if (!pu) {
		return { usedLabel: '—', effectLabel: null };
	}

	return {
		usedLabel: pu.activated ? 'Used' : 'Not used',
		effectLabel: pu.recorded_on_correct ? 'Applied on a correct answer' : null,
	};
}

export function hostTableCells(player = {}) {
	return {
		name: player.display_name || '—',
		score: player.score ?? 0,
		accuracy: player.accuracy ?? 0,
		correct: player.correct ?? 0,
		wrong: player.wrong ?? 0,
		missed: player.missed ?? 0,
		average_response_ms: player.average_response_ms ?? null,
		best_streak: player.best_streak || 0,
		powerUps: `${player.power_ups_used ?? 0}/${player.power_ups_available ?? 0}`,
	};
}

export function visiblePlayers(data) {
	if (!data?.viewer?.is_host) return [];
	return Array.isArray(data.players) ? data.players : [];
}
