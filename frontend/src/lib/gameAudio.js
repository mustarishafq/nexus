// @ts-nocheck
/**
 * Quiz audio engine — Web Audio oscillators only (no asset files).
 * BGM themes are structurally different. SFX is event-based, not pack-based.
 */

const STORAGE_MUSIC = 'nexus.games.muteMusic';
const STORAGE_SFX = 'nexus.games.muteSfx';
const STORAGE_BGM = 'nexus.games.bgmTheme';
const STORAGE_SFX_PACK = 'nexus.games.sfxPack';

export const DEFAULT_BGM_THEME = 'party';
export const DEFAULT_SFX_PACK = 'classic';

export const BGM_THEMES = [
	{ id: 'party', label: 'Party', hint: 'Upbeat · playful · bright', emoji: '🎉' },
	{ id: 'arcade', label: 'Arcade', hint: 'Retro · 8-bit · synthetic', emoji: '🕹️' },
	{ id: 'chill', label: 'Chill', hint: 'Calm · soft · unobtrusive', emoji: '🌴' },
	{ id: 'energy', label: 'Energy', hint: 'Fast · competitive · driving', emoji: '⚡' },
];

/** Kept for API/DB compatibility. Playback no longer depends on pack selection. */
export const SFX_PACKS = [
	{ id: 'classic', label: 'Classic' },
	{ id: 'chippy', label: 'Playful' },
	{ id: 'soft', label: 'Soft' },
	{ id: 'carnival', label: 'Bright' },
];

export const SFX_EVENTS = [
	'question-start',
	'timer-tick',
	'answer-lock',
	'correct',
	'wrong',
	'streak',
	'power-up',
	'reveal',
	'leaderboard',
	'winner',
	'timeout',
	'game-start',
	'game-finished',
	'podium',
];

/**
 * Distinct engines: tempo, waveform, pattern length, filter, and texture all differ.
 * Lobby vs game variants keep the same identity at different intensity.
 */
export const BGM_ENGINE = {
	party: {
		lobby: {
			bpm: 108,
			subdivision: 2,
			padType: 'triangle',
			melType: 'triangle',
			bassType: 'sine',
			filter: 1600,
			padGain: 0.03,
			melGain: 0.028,
			bassGain: 0.02,
			hats: false,
			swing: 0.14,
			pad: [261.63, 329.63, 392],
			bass: [130.81, 0, 130.81, 0, 146.83, 0, 130.81, 0],
			melody: [523.25, 587.33, 659.25, 783.99, 659.25, 587.33, 523.25, 0],
		},
		game: {
			bpm: 126,
			subdivision: 2,
			padType: 'triangle',
			melType: 'triangle',
			bassType: 'sine',
			filter: 1800,
			padGain: 0.026,
			melGain: 0.032,
			bassGain: 0.022,
			hats: false,
			swing: 0.1,
			pad: [196, 246.94, 293.66],
			bass: [98, 98, 110, 98, 130.81, 110, 98, 87.31],
			melody: [392, 493.88, 587.33, 659.25, 587.33, 523.25, 493.88, 392],
		},
	},
	arcade: {
		lobby: {
			bpm: 100,
			subdivision: 4,
			padType: 'square',
			melType: 'square',
			bassType: 'square',
			filter: 2400,
			padGain: 0.008,
			melGain: 0.018,
			bassGain: 0.016,
			hats: false,
			swing: 0,
			pad: [164.81],
			bass: [82.41, 0, 82.41, 0, 98, 0, 110, 0, 82.41, 0, 82.41, 0, 73.42, 0, 82.41, 0],
			melody: [329.63, 392, 493.88, 392, 329.63, 261.63, 329.63, 0, 392, 493.88, 587.33, 493.88, 392, 329.63, 261.63, 0],
		},
		game: {
			bpm: 152,
			subdivision: 4,
			padType: 'square',
			melType: 'square',
			bassType: 'square',
			filter: 2600,
			padGain: 0.006,
			melGain: 0.02,
			bassGain: 0.018,
			hats: true,
			hatEvery: 2,
			swing: 0,
			pad: [146.83],
			bass: [73.42, 73.42, 82.41, 73.42, 98, 82.41, 73.42, 65.41],
			melody: [293.66, 329.63, 392, 493.88, 392, 329.63, 293.66, 246.94, 293.66, 392, 493.88, 587.33, 493.88, 392, 329.63, 0],
		},
	},
	chill: {
		lobby: {
			bpm: 64,
			subdivision: 1,
			padType: 'sine',
			melType: 'sine',
			bassType: 'sine',
			filter: 900,
			padGain: 0.036,
			melGain: 0.012,
			bassGain: 0.018,
			hats: false,
			swing: 0,
			pad: [130.81, 155.56, 196],
			bass: [65.41, 73.42, 65.41, 58.27],
			melody: [196, 0, 220, 0],
		},
		game: {
			bpm: 76,
			subdivision: 1,
			padType: 'sine',
			melType: 'sine',
			bassType: 'sine',
			filter: 1000,
			padGain: 0.032,
			melGain: 0.016,
			bassGain: 0.02,
			hats: false,
			swing: 0,
			pad: [110, 130.81, 164.81],
			bass: [55, 65.41, 61.74, 55],
			melody: [220, 246.94, 0, 196],
		},
	},
	energy: {
		lobby: {
			bpm: 120,
			subdivision: 2,
			padType: 'sawtooth',
			melType: 'square',
			bassType: 'sawtooth',
			filter: 1400,
			padGain: 0.012,
			melGain: 0.02,
			bassGain: 0.024,
			hats: true,
			hatEvery: 2,
			swing: 0,
			pad: [146.83, 174.61, 220],
			bass: [73.42, 73.42, 82.41, 73.42, 98, 82.41, 73.42, 61.74],
			melody: [293.66, 0, 349.23, 293.66, 440, 349.23, 293.66, 246.94],
		},
		game: {
			bpm: 168,
			subdivision: 2,
			padType: 'sawtooth',
			melType: 'square',
			bassType: 'sawtooth',
			filter: 1700,
			padGain: 0.01,
			melGain: 0.022,
			bassGain: 0.028,
			hats: true,
			hatEvery: 1,
			swing: 0,
			pad: [110, 146.83, 164.81],
			bass: [55, 55, 61.74, 55, 73.42, 61.74, 55, 49],
			melody: [220, 246.94, 293.66, 329.63, 293.66, 246.94, 220, 196],
		},
	},
};

let ctx = null;
let unlocked = false;
let gestureArmed = false;
let bgmNode = null;
let activeBgm = null;
let desiredBgmOn = false;
let desiredPhase = 'lobby';
let previewToken = 0;
let lastTimerTickKey = null;
const playedSfxKeys = new Set();

function getCtx() {
	if (typeof window === 'undefined') return null;
	if (!ctx) {
		const AC = window.AudioContext || window.webkitAudioContext;
		if (!AC) return null;
		try {
			ctx = new AC();
		} catch {
			return null;
		}
	}
	return ctx;
}

export function isMusicMuted() {
	try {
		return localStorage.getItem(STORAGE_MUSIC) === '1';
	} catch {
		return false;
	}
}

export function isSfxMuted() {
	try {
		return localStorage.getItem(STORAGE_SFX) === '1';
	} catch {
		return false;
	}
}

export function setMusicMuted(muted) {
	try {
		localStorage.setItem(STORAGE_MUSIC, muted ? '1' : '0');
	} catch {
		// ignore
	}
	if (muted) stopBgm({ immediate: true });
	else if (desiredBgmOn) startBgm(true, currentBgm(), desiredPhase);
}

export function setSfxMuted(muted) {
	try {
		localStorage.setItem(STORAGE_SFX, muted ? '1' : '0');
	} catch {
		// ignore
	}
}

export function getStoredBgmTheme() {
	try {
		return normalizeBgmTheme(localStorage.getItem(STORAGE_BGM));
	} catch {
		return DEFAULT_BGM_THEME;
	}
}

export function getStoredSfxPack() {
	try {
		return normalizeSfxPack(localStorage.getItem(STORAGE_SFX_PACK));
	} catch {
		return DEFAULT_SFX_PACK;
	}
}

export function setStoredBgmTheme(id) {
	const theme = normalizeBgmTheme(id);
	try {
		localStorage.setItem(STORAGE_BGM, theme);
	} catch {
		// ignore
	}
	activeBgm = theme;
	if (desiredBgmOn && !isMusicMuted()) startBgm(true, theme, desiredPhase);
}

export function setStoredSfxPack(id) {
	try {
		localStorage.setItem(STORAGE_SFX_PACK, normalizeSfxPack(id));
	} catch {
		// ignore
	}
}

export function setSessionAudio({ bgmTheme } = {}) {
	if (bgmTheme) activeBgm = normalizeBgmTheme(bgmTheme);
}

function currentBgm() {
	return normalizeBgmTheme(activeBgm || getStoredBgmTheme());
}

export function normalizeBgmTheme(id) {
	if (id && BGM_ENGINE[id]) return id;
	return DEFAULT_BGM_THEME;
}

export function normalizeSfxPack(id) {
	if (SFX_PACKS.some((pack) => pack.id === id)) return id;
	return DEFAULT_SFX_PACK;
}

export function bgmThemeFingerprint(themeId) {
	const theme = BGM_ENGINE[normalizeBgmTheme(themeId)];
	const summarize = (phase) => ({
		bpm: phase.bpm,
		subdivision: phase.subdivision,
		padType: phase.padType,
		melType: phase.melType,
		bassType: phase.bassType,
		filter: phase.filter,
		hats: Boolean(phase.hats),
		swing: phase.swing,
		melody: phase.melody.join(','),
		bass: phase.bass.join(','),
	});
	return { lobby: summarize(theme.lobby), game: summarize(theme.game) };
}

export async function unlockAudio() {
	const audio = getCtx();
	if (!audio) return false;
	try {
		if (audio.state === 'suspended') await audio.resume();
	} catch {
		return false;
	}
	if (audio.state === 'running') {
		unlocked = true;
		return true;
	}
	return false;
}

export function armUnlockOnGesture() {
	if (typeof window === 'undefined' || gestureArmed) return;
	gestureArmed = true;
	const onGesture = () => {
		void unlockAudio().then((ok) => {
			if (ok && desiredBgmOn && !isMusicMuted()) {
				startBgm(true, currentBgm(), desiredPhase);
			}
		});
	};
	window.addEventListener('pointerdown', onGesture, { once: true, capture: true });
	window.addEventListener('keydown', onGesture, { once: true, capture: true });
}

function safeConnect(from, to) {
	try {
		from.connect(to);
	} catch {
		// ignore
	}
}

function tone(freq, duration = 0.15, type = 'sine', gain = 0.05, when = 0) {
	const audio = getCtx();
	if (!audio || !unlocked || isSfxMuted() || !freq) return;
	try {
		const osc = audio.createOscillator();
		const g = audio.createGain();
		osc.type = type;
		osc.frequency.value = freq;
		g.gain.value = Math.max(0.0001, gain);
		safeConnect(osc, g);
		safeConnect(g, audio.destination);
		const start = audio.currentTime + when;
		osc.start(start);
		g.gain.setValueAtTime(Math.max(0.0001, gain), start);
		g.gain.exponentialRampToValueAtTime(0.001, start + duration);
		osc.stop(start + duration + 0.03);
	} catch {
		// ignore
	}
}

function slide(fromFreq, toFreq, duration = 0.22, type = 'sine', gain = 0.04) {
	const audio = getCtx();
	if (!audio || !unlocked || isSfxMuted()) return;
	try {
		const osc = audio.createOscillator();
		const g = audio.createGain();
		osc.type = type;
		osc.frequency.setValueAtTime(fromFreq, audio.currentTime);
		osc.frequency.exponentialRampToValueAtTime(Math.max(30, toFreq), audio.currentTime + duration);
		g.gain.value = gain;
		safeConnect(osc, g);
		safeConnect(g, audio.destination);
		osc.start();
		g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
		osc.stop(audio.currentTime + duration + 0.03);
	} catch {
		// ignore
	}
}

function noiseBurst(duration = 0.08, gain = 0.03, when = 0) {
	const audio = getCtx();
	if (!audio || !unlocked || isSfxMuted()) return;
	try {
		const length = Math.max(1, Math.floor(audio.sampleRate * duration));
		const buffer = audio.createBuffer(1, length, audio.sampleRate);
		const data = buffer.getChannelData(0);
		for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
		const src = audio.createBufferSource();
		const g = audio.createGain();
		const filter = audio.createBiquadFilter();
		filter.type = 'highpass';
		filter.frequency.value = 1800;
		src.buffer = buffer;
		g.gain.value = gain;
		safeConnect(src, filter);
		safeConnect(filter, g);
		safeConnect(g, audio.destination);
		const start = audio.currentTime + when;
		src.start(start);
		src.stop(start + duration);
	} catch {
		// ignore
	}
}

const SFX_MAP = {
	'question-start': () => {
		tone(392, 0.12, 'triangle', 0.04);
		tone(523.25, 0.16, 'triangle', 0.038, 0.08);
	},
	'timer-tick': () => {
		tone(880, 0.04, 'square', 0.012);
	},
	'answer-lock': () => {
		tone(498, 0.07, 'sine', 0.035);
	},
	correct: () => {
		tone(523.25, 0.14, 'sine', 0.04);
		tone(659.25, 0.16, 'sine', 0.038, 0.07);
		tone(783.99, 0.28, 'triangle', 0.042, 0.14);
	},
	wrong: () => {
		slide(220, 110, 0.28, 'triangle', 0.04);
	},
	streak: () => {
		tone(523.25, 0.1, 'triangle', 0.036);
		tone(659.25, 0.1, 'triangle', 0.036, 0.08);
		tone(783.99, 0.12, 'triangle', 0.038, 0.16);
		tone(1046.5, 0.22, 'sine', 0.04, 0.26);
	},
	'power-up': () => {
		slide(300, 720, 0.22, 'square', 0.03);
		tone(960, 0.12, 'triangle', 0.028, 0.18);
	},
	reveal: () => {
		tone(196, 0.12, 'sawtooth', 0.02);
		tone(392, 0.22, 'triangle', 0.038, 0.1);
	},
	leaderboard: () => {
		tone(349.23, 0.12, 'triangle', 0.034);
		tone(440, 0.14, 'triangle', 0.034, 0.1);
		tone(523.25, 0.28, 'sine', 0.038, 0.2);
	},
	winner: () => {
		tone(392, 0.16, 'triangle', 0.04);
		tone(523.25, 0.16, 'triangle', 0.04, 0.12);
		tone(659.25, 0.18, 'triangle', 0.042, 0.24);
		tone(783.99, 0.4, 'sine', 0.045, 0.38);
	},
	timeout: () => {
		noiseBurst(0.1, 0.04);
		slide(180, 90, 0.2, 'square', 0.03);
	},
	'game-start': () => {
		tone(261.63, 0.12, 'triangle', 0.036);
		tone(329.63, 0.12, 'triangle', 0.036, 0.1);
		tone(392, 0.12, 'triangle', 0.036, 0.2);
		tone(523.25, 0.28, 'sine', 0.04, 0.32);
	},
	'game-finished': () => {
		tone(392, 0.18, 'sine', 0.034);
		tone(261.63, 0.32, 'triangle', 0.032, 0.16);
	},
	podium: () => {
		tone(523.25, 0.14, 'triangle', 0.036);
		tone(659.25, 0.16, 'triangle', 0.038, 0.12);
		tone(783.99, 0.18, 'triangle', 0.04, 0.24);
		tone(1046.5, 0.42, 'sine', 0.042, 0.38);
	},
};

export function playSfx(name) {
	if (isSfxMuted()) return false;
	try {
		const fn = SFX_MAP[name];
		if (!fn) return false;
		fn();
		return true;
	} catch {
		return false;
	}
}

export function playSfxOnce(key, name) {
	if (!key) return false;
	if (playedSfxKeys.has(key)) return false;
	playedSfxKeys.add(key);
	return playSfx(name);
}

export function timerTickKey(questionId, secondsLeft) {
	const seconds = Number(secondsLeft);
	if (!(seconds > 0 && seconds <= 5)) return null;
	return `${questionId ?? 'q'}:${seconds}`;
}

export function emitTimerTick(questionId, secondsLeft) {
	const key = timerTickKey(questionId, secondsLeft);
	if (!key || key === lastTimerTickKey) return false;
	lastTimerTickKey = key;
	return playSfx('timer-tick');
}

export function previewSfx(name = 'correct') {
	return playSfx(name);
}

export function previewSfxPack() {
	return previewSfx('correct');
}

function disposeBgm(node) {
	if (!node) return;
	try {
		clearTimeout(node._timer);
		node.lfo?.stop();
		node.melOsc?.stop();
		node.bassOsc?.stop();
		node.pads?.forEach(({ osc }) => osc.stop());
		node.hatTimer && clearTimeout(node.hatTimer);
		node.lfo?.disconnect();
		node.lfoGain?.disconnect();
		node.melOsc?.disconnect();
		node.melGain?.disconnect();
		node.bassOsc?.disconnect();
		node.bassGain?.disconnect();
		node.pads?.forEach(({ osc, g }) => {
			osc.disconnect();
			g.disconnect();
		});
		node.filter?.disconnect();
		node.master?.disconnect();
	} catch {
		// ignore
	}
}

export function stopBgm({ immediate = false } = {}) {
	if (!bgmNode) return;
	const node = bgmNode;
	bgmNode = null;
	clearTimeout(node._timer);
	clearTimeout(node.hatTimer);
	const audio = getCtx();
	if (immediate || !audio) {
		disposeBgm(node);
		return;
	}
	try {
		const t = audio.currentTime;
		node.master.gain.cancelScheduledValues(t);
		node.master.gain.setValueAtTime(Math.max(0.0001, node.master.gain.value), t);
		node.master.gain.linearRampToValueAtTime(0.0001, t + 0.25);
	} catch {
		// ignore
	}
	setTimeout(() => disposeBgm(node), 280);
}

export function stopLobby() {
	desiredBgmOn = false;
	stopBgm({ immediate: true });
}

export function wouldRestartBgm(theme, phase) {
	const playPhase = phase === 'game' ? 'game' : 'lobby';
	const nextTheme = normalizeBgmTheme(theme);
	return !(bgmNode?.theme === nextTheme && bgmNode?.phase === playPhase);
}

export function getActiveBgm() {
	if (!bgmNode) return null;
	return { theme: bgmNode.theme, phase: bgmNode.phase };
}

export function startBgm(sessionMusicEnabled = true, themeOverride = null, phase = null, options = {}) {
	const preview = Boolean(options.preview);
	if (!preview) desiredBgmOn = Boolean(sessionMusicEnabled);
	if (phase && !preview) desiredPhase = phase === 'game' ? 'game' : 'lobby';
	if (!preview && (!sessionMusicEnabled || isMusicMuted())) {
		stopBgm({ immediate: true });
		return false;
	}

	const audio = getCtx();
	if (!audio || !unlocked) return false;

	const theme = normalizeBgmTheme(themeOverride || currentBgm());
	const playPhase = (preview ? phase : desiredPhase) === 'game' ? 'game' : 'lobby';
	if (!preview && bgmNode?.theme === theme && bgmNode?.phase === playPhase) return false;

	stopBgm({ immediate: true });
	if (!preview) desiredBgmOn = true;

	const themeCfg = BGM_ENGINE[theme] || BGM_ENGINE.party;
	const cfg = themeCfg[playPhase] || themeCfg.lobby;

	try {
		const master = audio.createGain();
		master.gain.value = 0.0001;
		safeConnect(master, audio.destination);

		const filter = audio.createBiquadFilter();
		filter.type = 'lowpass';
		filter.frequency.value = cfg.filter;
		filter.Q.value = 0.7;
		safeConnect(filter, master);

		const pads = (cfg.pad || []).map((freq, i) => {
			const osc = audio.createOscillator();
			const g = audio.createGain();
			osc.type = cfg.padType;
			osc.frequency.value = freq;
			g.gain.value = cfg.padGain * (i === 0 ? 1 : 0.62);
			safeConnect(osc, g);
			safeConnect(g, filter);
			osc.start();
			return { osc, g };
		});

		const melOsc = audio.createOscillator();
		const melGain = audio.createGain();
		melOsc.type = cfg.melType;
		melOsc.frequency.value = cfg.melody.find(Boolean) || 440;
		melGain.gain.value = 0.0001;
		safeConnect(melOsc, melGain);
		safeConnect(melGain, filter);
		melOsc.start();

		const bassOsc = audio.createOscillator();
		const bassGain = audio.createGain();
		bassOsc.type = cfg.bassType;
		bassOsc.frequency.value = cfg.bass.find(Boolean) || 80;
		bassGain.gain.value = 0.0001;
		safeConnect(bassOsc, bassGain);
		safeConnect(bassGain, filter);
		bassOsc.start();

		const lfo = audio.createOscillator();
		const lfoGain = audio.createGain();
		lfo.type = 'sine';
		lfo.frequency.value = playPhase === 'game' ? 0.32 : 0.16;
		lfoGain.gain.value = cfg.padGain * 0.22;
		safeConnect(lfo, lfoGain);
		pads.forEach(({ g }) => {
			try {
				lfoGain.connect(g.gain);
			} catch {
				// ignore
			}
		});
		lfo.start();

		master.gain.linearRampToValueAtTime(1, audio.currentTime + 0.45);

		bgmNode = {
			theme,
			phase: playPhase,
			preview,
			master,
			filter,
			pads,
			melOsc,
			melGain,
			bassOsc,
			bassGain,
			lfo,
			lfoGain,
			cfg,
			_step: 0,
			_timer: null,
			hatTimer: null,
		};

		const stepMs = () => (60000 / cfg.bpm) / cfg.subdivision;

		const pulse = () => {
			if (!bgmNode || bgmNode.master !== master) return;
			const t = audio.currentTime;
			const melody = cfg.melody[bgmNode._step % cfg.melody.length] || 0;
			const bass = cfg.bass[bgmNode._step % cfg.bass.length] || 0;
			const swing = cfg.swing && bgmNode._step % 2 === 1 ? stepMs() * cfg.swing : 0;

			if (melody) {
				bgmNode.melOsc.frequency.setTargetAtTime(melody, t, 0.012);
				bgmNode.melGain.gain.cancelScheduledValues(t);
				bgmNode.melGain.gain.setValueAtTime(0.0001, t);
				bgmNode.melGain.gain.linearRampToValueAtTime(cfg.melGain, t + 0.03);
				bgmNode.melGain.gain.linearRampToValueAtTime(0.0001, t + (stepMs() / 1000) * 0.72);
			}

			if (bass) {
				bgmNode.bassOsc.frequency.setTargetAtTime(bass, t, 0.02);
				bgmNode.bassGain.gain.cancelScheduledValues(t);
				bgmNode.bassGain.gain.setValueAtTime(0.0001, t);
				bgmNode.bassGain.gain.linearRampToValueAtTime(cfg.bassGain, t + 0.02);
				bgmNode.bassGain.gain.linearRampToValueAtTime(cfg.bassGain * 0.35, t + (stepMs() / 1000) * 0.8);
			}

			if (cfg.hats && (bgmNode._step % (cfg.hatEvery || 2) === 0) && unlocked && !isMusicMuted()) {
				try {
					const length = Math.max(1, Math.floor(audio.sampleRate * 0.03));
					const buffer = audio.createBuffer(1, length, audio.sampleRate);
					const data = buffer.getChannelData(0);
					for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
					const src = audio.createBufferSource();
					const g = audio.createGain();
					src.buffer = buffer;
					g.gain.value = playPhase === 'game' ? 0.012 : 0.007;
					safeConnect(src, g);
					safeConnect(g, filter);
					src.start(t);
					src.stop(t + 0.03);
				} catch {
					// ignore
				}
			}

			bgmNode._step += 1;
			bgmNode._timer = setTimeout(pulse, stepMs() + swing);
		};
		pulse();
		return true;
	} catch {
		return false;
	}
}

export function startLobby(sessionMusicEnabled = true, themeOverride = null) {
	return startBgm(sessionMusicEnabled, themeOverride, 'lobby');
}

export function syncGameMusic(sessionMusicEnabled, theme = null, playingOrPhase = 'lobby') {
	if (theme) activeBgm = normalizeBgmTheme(theme);
	if (playingOrPhase === false || playingOrPhase === 'off') {
		desiredBgmOn = false;
		stopBgm({ immediate: false });
		return;
	}
	const phase = playingOrPhase === 'game' ? 'game' : 'lobby';
	desiredPhase = phase;
	desiredBgmOn = Boolean(sessionMusicEnabled);
	if (desiredBgmOn && !isMusicMuted()) {
		startBgm(true, theme || currentBgm(), phase);
	} else {
		stopBgm({ immediate: true });
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
	const token = ++previewToken;
	const snapshot = {
		desiredBgmOn,
		desiredPhase,
		theme: currentBgm(),
		muted: isMusicMuted(),
	};
	return unlockAudio().then((ok) => {
		if (!ok || token !== previewToken) return false;
		startBgm(true, themeId, phase, { preview: true });
		setTimeout(() => {
			if (token !== previewToken) return;
			stopBgm({ immediate: true });
			if (snapshot.muted) return;
			if (snapshot.desiredBgmOn) startBgm(true, snapshot.theme, snapshot.desiredPhase);
		}, 2800);
		return true;
	}).catch(() => false);
}

export function resetAudioGates() {
	playedSfxKeys.clear();
	lastTimerTickKey = null;
	previewToken += 1;
}

export function resetAudioForTests() {
	resetAudioGates();
	desiredBgmOn = false;
	desiredPhase = 'lobby';
	activeBgm = null;
	unlocked = true;
	stopBgm({ immediate: true });
	try {
		localStorage.removeItem(STORAGE_MUSIC);
		localStorage.removeItem(STORAGE_SFX);
		localStorage.removeItem(STORAGE_BGM);
		localStorage.removeItem(STORAGE_SFX_PACK);
	} catch {
		// ignore
	}
}
