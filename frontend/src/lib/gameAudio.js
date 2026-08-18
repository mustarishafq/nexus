// @ts-nocheck
/**
 * Soft game audio — gentle ambient BGM (Kahoot-like energy without harsh tones).
 * Lobby = warm waiting pad. Game = light pulse, still soft.
 */

const STORAGE_MUSIC = 'nexus.games.muteMusic';
const STORAGE_SFX = 'nexus.games.muteSfx';
const STORAGE_BGM = 'nexus.games.bgmTheme';
const STORAGE_SFX_PACK = 'nexus.games.sfxPack';

export const BGM_THEMES = [
	{ id: 'party', label: 'Party Pop', hint: 'Warm lobby · light pulse in-game', emoji: '🎉' },
	{ id: 'arcade', label: 'Arcade Soft', hint: 'Playful lobby · gentle race pulse', emoji: '🕹️' },
	{ id: 'chill', label: 'Chill Lounge', hint: 'Calm lobby · soft focus in-game', emoji: '🌴' },
	{ id: 'energy', label: 'Upbeat', hint: 'Bright lobby · steady game groove', emoji: '⚡' },
];

export const SFX_PACKS = [
	{ id: 'classic', label: 'Classic', hint: 'Soft quiz chimes', emoji: '🔔' },
	{ id: 'chippy', label: 'Playful', hint: 'Light blips', emoji: '👾' },
	{ id: 'soft', label: 'Soft', hint: 'Gentle tones', emoji: '🎵' },
	{ id: 'carnival', label: 'Bright', hint: 'Happy accents', emoji: '🎪' },
];

let ctx = null;
let unlocked = false;
let bgmNode = null;
let activeBgm = null;
let activeSfx = null;
let desiredBgmOn = false;
let desiredPhase = 'lobby';

function getCtx() {
	if (!ctx) {
		const AC = window.AudioContext || window.webkitAudioContext;
		if (!AC) return null;
		ctx = new AC();
	}
	return ctx;
}

export function isMusicMuted() {
	return localStorage.getItem(STORAGE_MUSIC) === '1';
}

export function isSfxMuted() {
	return localStorage.getItem(STORAGE_SFX) === '1';
}

export function setMusicMuted(muted) {
	localStorage.setItem(STORAGE_MUSIC, muted ? '1' : '0');
	if (muted) stopBgm();
	else if (desiredBgmOn) startBgm(true, currentBgm(), desiredPhase);
}

export function setSfxMuted(muted) {
	localStorage.setItem(STORAGE_SFX, muted ? '1' : '0');
}

export function getStoredBgmTheme() {
	return localStorage.getItem(STORAGE_BGM) || 'party';
}

export function getStoredSfxPack() {
	return localStorage.getItem(STORAGE_SFX_PACK) || 'soft';
}

export function setStoredBgmTheme(id) {
	localStorage.setItem(STORAGE_BGM, id);
	activeBgm = id;
	if (bgmNode || desiredBgmOn) {
		stopBgm();
		startBgm(true, id, desiredPhase);
	}
}

export function setStoredSfxPack(id) {
	localStorage.setItem(STORAGE_SFX_PACK, id);
	activeSfx = id;
}

export function setSessionAudio({ bgmTheme, sfxPack } = {}) {
	if (bgmTheme) activeBgm = bgmTheme;
	if (sfxPack) activeSfx = sfxPack;
}

function currentBgm() {
	return activeBgm || getStoredBgmTheme();
}

function currentSfx() {
	return activeSfx || getStoredSfxPack();
}

export async function unlockAudio() {
	const audio = getCtx();
	if (!audio) return;
	if (audio.state === 'suspended') {
		try {
			await audio.resume();
		} catch {
			// ignore
		}
	}
	unlocked = true;
}

function tone(freq, duration = 0.15, type = 'sine', gain = 0.05, when = 0) {
	const audio = getCtx();
	if (!audio || !unlocked || isSfxMuted()) return;
	const osc = audio.createOscillator();
	const g = audio.createGain();
	osc.type = type;
	osc.frequency.value = freq;
	g.gain.value = gain;
	osc.connect(g);
	g.connect(audio.destination);
	const start = audio.currentTime + when;
	osc.start(start);
	g.gain.exponentialRampToValueAtTime(0.001, start + duration);
	osc.stop(start + duration + 0.02);
}

function chord(freqs, duration = 0.4, gain = 0.04) {
	freqs.forEach((f, i) => tone(f, duration, 'sine', gain, i * 0.03));
}

const SFX_MAP = {
	classic: {
		'question-start': () => chord([392, 523, 659], 0.35, 0.04),
		'timer-tick': () => tone(720, 0.05, 'sine', 0.025),
		'answer-lock': () => tone(480, 0.1, 'sine', 0.04),
		correct: () => chord([523, 659, 784], 0.45, 0.045),
		wrong: () => tone(240, 0.28, 'sine', 0.03),
		streak: () => chord([523, 659, 784, 988], 0.5, 0.04),
		'power-up': () => { tone(620, 0.1, 'sine', 0.04); tone(780, 0.12, 'sine', 0.035, 0.08); },
		leaderboard: () => chord([349, 440, 523], 0.45, 0.04),
		winner: () => chord([392, 523, 659, 784], 0.7, 0.05),
	},
	chippy: {
		'question-start': () => chord([330, 415, 523], 0.3, 0.035),
		'timer-tick': () => tone(660, 0.04, 'triangle', 0.025),
		'answer-lock': () => tone(520, 0.08, 'triangle', 0.035),
		correct: () => chord([440, 554, 659], 0.4, 0.04),
		wrong: () => tone(200, 0.25, 'triangle', 0.03),
		streak: () => chord([440, 554, 659, 880], 0.45, 0.035),
		'power-up': () => { tone(700, 0.08, 'triangle', 0.035); tone(880, 0.1, 'triangle', 0.03, 0.07); },
		leaderboard: () => chord([294, 370, 440], 0.4, 0.035),
		winner: () => chord([440, 554, 659, 880], 0.6, 0.04),
	},
	soft: {
		'question-start': () => chord([349, 440, 523], 0.45, 0.03),
		'timer-tick': () => tone(580, 0.06, 'sine', 0.02),
		'answer-lock': () => tone(400, 0.12, 'sine', 0.03),
		correct: () => chord([523, 659, 784], 0.5, 0.035),
		wrong: () => tone(220, 0.35, 'sine', 0.025),
		streak: () => chord([523, 659, 784], 0.55, 0.03),
		'power-up': () => tone(560, 0.18, 'sine', 0.03),
		leaderboard: () => chord([330, 415, 494], 0.5, 0.03),
		winner: () => chord([392, 523, 659, 784], 0.75, 0.04),
	},
	carnival: {
		'question-start': () => chord([392, 494, 587], 0.35, 0.04),
		'timer-tick': () => tone(640, 0.05, 'sine', 0.025),
		'answer-lock': () => tone(470, 0.1, 'sine', 0.035),
		correct: () => chord([523, 659, 784], 0.45, 0.04),
		wrong: () => tone(210, 0.28, 'sine', 0.028),
		streak: () => chord([554, 698, 830], 0.5, 0.035),
		'power-up': () => { tone(680, 0.09, 'sine', 0.035); tone(860, 0.1, 'sine', 0.03, 0.08); },
		leaderboard: () => chord([370, 466, 554], 0.45, 0.035),
		winner: () => chord([523, 659, 784, 988], 0.7, 0.045),
	},
};

export function playSfx(name) {
	if (isSfxMuted()) return;
	const pack = SFX_MAP[currentSfx()] || SFX_MAP.soft;
	(pack[name] || SFX_MAP.soft[name])?.();
}

export function previewSfxPack(packId) {
	const prev = activeSfx;
	activeSfx = packId;
	playSfx('correct');
	setTimeout(() => { activeSfx = prev; }, 600);
}

/**
 * Soft ambient configs — sine pads only, low gain, smooth envelopes.
 * Lobby = slower / warmer. Game = slightly quicker pulse, still gentle.
 */
const BGM_CONFIG = {
	party: {
		lobby: { roots: [196, 247, 294], melody: [392, 440, 494, 523, 494, 440], interval: 900, pad: 0.028, mel: 0.018 },
		game: { roots: [147, 196, 220], melody: [294, 330, 370, 392, 370, 330], interval: 520, pad: 0.024, mel: 0.022 },
	},
	arcade: {
		lobby: { roots: [165, 196, 247], melody: [330, 370, 392, 440, 392, 370], interval: 820, pad: 0.024, mel: 0.016 },
		game: { roots: [123, 165, 196], melody: [247, 294, 330, 349, 330, 294], interval: 480, pad: 0.022, mel: 0.02 },
	},
	chill: {
		lobby: { roots: [130, 164, 196], melody: [196, 220, 247, 262, 247, 220], interval: 1100, pad: 0.032, mel: 0.014 },
		game: { roots: [98, 147, 185], melody: [220, 247, 262, 294, 262, 247], interval: 640, pad: 0.028, mel: 0.018 },
	},
	energy: {
		lobby: { roots: [147, 185, 220], melody: [294, 330, 370, 392, 370, 330], interval: 760, pad: 0.026, mel: 0.017 },
		game: { roots: [110, 147, 185], melody: [277, 311, 349, 370, 349, 311], interval: 440, pad: 0.023, mel: 0.021 },
	},
};

export function startBgm(sessionMusicEnabled = true, themeOverride = null, phase = null) {
	desiredBgmOn = Boolean(sessionMusicEnabled);
	if (phase) desiredPhase = phase;
	if (!sessionMusicEnabled || isMusicMuted()) {
		stopBgm();
		return;
	}

	const audio = getCtx();
	if (!audio || !unlocked) return;

	const theme = themeOverride || currentBgm();
	const playPhase = desiredPhase === 'game' ? 'game' : 'lobby';
	if (bgmNode?.theme === theme && bgmNode?.phase === playPhase) return;

	stopBgm();
	desiredBgmOn = true;

	const themeCfg = BGM_CONFIG[theme] || BGM_CONFIG.party;
	const cfg = themeCfg[playPhase] || themeCfg.lobby;

	const master = audio.createGain();
	master.gain.value = 0.0001;
	master.connect(audio.destination);

	// Warm filter so nothing sounds buzzy
	const filter = audio.createBiquadFilter();
	filter.type = 'lowpass';
	filter.frequency.value = playPhase === 'game' ? 1400 : 1100;
	filter.Q.value = 0.6;
	filter.connect(master);

	const pads = cfg.roots.map((freq, i) => {
		const osc = audio.createOscillator();
		const g = audio.createGain();
		osc.type = 'sine';
		osc.frequency.value = freq;
		g.gain.value = cfg.pad * (i === 0 ? 1 : 0.7);
		osc.connect(g);
		g.connect(filter);
		osc.start();
		return { osc, g };
	});

	const melOsc = audio.createOscillator();
	const melGain = audio.createGain();
	melOsc.type = 'sine';
	melOsc.frequency.value = cfg.melody[0];
	melGain.gain.value = 0.0001;
	melOsc.connect(melGain);
	melGain.connect(filter);
	melOsc.start();

	// Slow volume breathe on pads (very subtle)
	const lfo = audio.createOscillator();
	const lfoGain = audio.createGain();
	lfo.type = 'sine';
	lfo.frequency.value = playPhase === 'game' ? 0.35 : 0.18;
	lfoGain.gain.value = cfg.pad * 0.25;
	lfo.connect(lfoGain);
	pads.forEach(({ g }) => {
		try {
			lfoGain.connect(g.gain);
		} catch {
			// ignore
		}
	});
	lfo.start();

	master.gain.linearRampToValueAtTime(1, audio.currentTime + 0.8);

	bgmNode = {
		theme,
		phase: playPhase,
		master,
		filter,
		pads,
		melOsc,
		melGain,
		lfo,
		lfoGain,
		melody: cfg.melody,
		melodyGain: cfg.mel,
		interval: cfg.interval,
		_step: 0,
		_timer: null,
	};

	const pulse = () => {
		if (!bgmNode) return;
		const t = audio.currentTime;
		const note = bgmNode.melody[bgmNode._step % bgmNode.melody.length];
		bgmNode.melOsc.frequency.setTargetAtTime(note, t, 0.04);
		bgmNode.melGain.gain.cancelScheduledValues(t);
		bgmNode.melGain.gain.setValueAtTime(0.0001, t);
		bgmNode.melGain.gain.linearRampToValueAtTime(bgmNode.melodyGain, t + 0.12);
		bgmNode.melGain.gain.linearRampToValueAtTime(0.0001, t + (bgmNode.interval / 1000) * 0.75);
		bgmNode._step += 1;
		bgmNode._timer = setTimeout(pulse, bgmNode.interval);
	};
	pulse();
}

export function startLobby(sessionMusicEnabled = true, themeOverride = null) {
	return startBgm(sessionMusicEnabled, themeOverride, 'lobby');
}

export function stopBgm() {
	if (!bgmNode) return;
	try {
		clearTimeout(bgmNode._timer);
		const audio = getCtx();
		const t = audio?.currentTime ?? 0;
		bgmNode.master.gain.cancelScheduledValues(t);
		bgmNode.master.gain.setValueAtTime(Math.max(0.0001, bgmNode.master.gain.value), t);
		bgmNode.master.gain.linearRampToValueAtTime(0.0001, t + 0.35);
		const node = bgmNode;
		setTimeout(() => {
			try {
				node.lfo?.stop();
				node.melOsc.stop();
				node.pads.forEach(({ osc }) => osc.stop());
				node.lfo?.disconnect();
				node.lfoGain?.disconnect();
				node.melOsc.disconnect();
				node.melGain.disconnect();
				node.pads.forEach(({ osc, g }) => {
					osc.disconnect();
					g.disconnect();
				});
				node.filter?.disconnect();
				node.master.disconnect();
			} catch {
				// ignore
			}
		}, 400);
	} catch {
		// ignore
	}
	bgmNode = null;
}

export function stopLobby() {
	desiredBgmOn = false;
	stopBgm();
}

export function syncGameMusic(sessionMusicEnabled, theme = null, playingOrPhase = 'lobby') {
	if (theme) activeBgm = theme;
	if (playingOrPhase === false || playingOrPhase === 'off') {
		desiredBgmOn = false;
		stopBgm();
		return;
	}
	const phase = playingOrPhase === 'game' ? 'game' : 'lobby';
	desiredPhase = phase;
	desiredBgmOn = Boolean(sessionMusicEnabled);
	if (desiredBgmOn && !isMusicMuted()) {
		startBgm(true, theme || currentBgm(), phase);
	} else {
		stopBgm();
	}
}

export function syncLobbyMusic(sessionMusicEnabled, theme = null) {
	syncGameMusic(sessionMusicEnabled, theme, 'lobby');
}

export function phaseForSessionStatus(status) {
	if (!status || status === 'finished') return 'off';
	if (status === 'lobby') return 'lobby';
	return 'game';
}

export function previewBgmTheme(themeId, phase = 'lobby') {
	unlockAudio().then(() => {
		const prevMute = isMusicMuted();
		if (prevMute) localStorage.setItem(STORAGE_MUSIC, '0');
		const wasDesired = desiredBgmOn;
		const prevPhase = desiredPhase;
		stopBgm();
		startBgm(true, themeId, phase);
		setTimeout(() => {
			stopBgm();
			if (prevMute) localStorage.setItem(STORAGE_MUSIC, '1');
			if (wasDesired && !isMusicMuted()) startBgm(true, currentBgm(), prevPhase);
		}, 3200);
	});
}
