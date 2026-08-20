import assert from 'node:assert/strict';
import { afterEach, before, test } from 'node:test';

function installAudioMocks() {
	const store = {};
	const fakeParam = (value = 0) => ({
		value,
		setValueAtTime() {},
		linearRampToValueAtTime() {},
		exponentialRampToValueAtTime() {},
		setTargetAtTime() {},
		cancelScheduledValues() {},
	});
	class FakeNode {
		constructor() {
			this.frequency = fakeParam(440);
			this.gain = fakeParam(0.001);
			this.Q = fakeParam(0.7);
			this.type = 'sine';
			this.buffer = null;
		}

		connect() {
			return this;
		}

		disconnect() {}

		start() {}

		stop() {}
	}
	class FakeCtx {
		constructor() {
			this.currentTime = 0;
			this.state = 'running';
			this.destination = new FakeNode();
			this.sampleRate = 44100;
		}

		createOscillator() {
			return new FakeNode();
		}

		createGain() {
			return new FakeNode();
		}

		createBiquadFilter() {
			return new FakeNode();
		}

		createBuffer(_channels, length) {
			return { getChannelData: () => new Float32Array(length || 1) };
		}

		createBufferSource() {
			return new FakeNode();
		}

		resume() {
			this.state = 'running';
			return Promise.resolve();
		}
	}

	globalThis.window = globalThis;
	globalThis.AudioContext = FakeCtx;
	globalThis.webkitAudioContext = FakeCtx;
	globalThis.localStorage = {
		getItem: (key) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
		setItem: (key, value) => {
			store[key] = String(value);
		},
		removeItem: (key) => {
			delete store[key];
		},
	};
}

installAudioMocks();
const audio = await import('./gameAudio.js');

before(() => {
	audio.resetAudioForTests();
});

afterEach(() => {
	audio.resetAudioForTests();
});

test('four BGM themes exist with distinct engines', () => {
	assert.deepEqual(audio.BGM_THEMES.map((theme) => theme.id), ['party', 'arcade', 'chill', 'energy']);
	const prints = audio.BGM_THEMES.map((theme) => JSON.stringify(audio.bgmThemeFingerprint(theme.id)));
	assert.equal(new Set(prints).size, 4);

	const party = audio.bgmThemeFingerprint('party');
	const arcade = audio.bgmThemeFingerprint('arcade');
	const chill = audio.bgmThemeFingerprint('chill');
	const energy = audio.bgmThemeFingerprint('energy');

	assert.equal(party.lobby.padType, 'triangle');
	assert.equal(arcade.game.melType, 'square');
	assert.equal(chill.lobby.bpm < party.lobby.bpm, true);
	assert.equal(energy.game.bpm > arcade.lobby.bpm, true);
	assert.equal(arcade.game.hats, true);
	assert.equal(chill.lobby.hats, false);
	assert.notEqual(party.game.melody, energy.game.melody);
});

test('required SFX events exist and play while unmuted', () => {
	assert.deepEqual(audio.SFX_EVENTS, [
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
	]);
	for (const name of audio.SFX_EVENTS) {
		assert.equal(audio.playSfx(name), true, name);
	}
});

test('music mute blocks BGM and is independent from SFX mute', () => {
	audio.setSfxMuted(false);
	audio.setMusicMuted(true);
	assert.equal(audio.isMusicMuted(), true);
	assert.equal(audio.isSfxMuted(), false);
	assert.equal(audio.startBgm(true, 'party', 'game'), false);
	assert.equal(audio.getActiveBgm(), null);
	assert.equal(audio.playSfx('correct'), true);

	audio.setMusicMuted(false);
	audio.setSfxMuted(true);
	assert.equal(audio.isMusicMuted(), false);
	assert.equal(audio.isSfxMuted(), true);
	assert.equal(audio.startBgm(true, 'arcade', 'lobby'), true);
	assert.equal(audio.getActiveBgm()?.theme, 'arcade');
	assert.equal(audio.playSfx('wrong'), false);
});

test('timer tick only emits once per second per question', () => {
	assert.equal(audio.emitTimerTick(9, 5), true);
	assert.equal(audio.emitTimerTick(9, 5), false);
	assert.equal(audio.emitTimerTick(9, 5), false);
	assert.equal(audio.emitTimerTick(9, 4), true);
	assert.equal(audio.emitTimerTick(9, 4), false);
	assert.equal(audio.emitTimerTick(9, 1), true);
	assert.equal(audio.emitTimerTick(12, 5), true);
	assert.equal(audio.timerTickKey(9, 6), null);
	assert.equal(audio.timerTickKey(9, 0), null);
});

test('same question/result SFX does not repeat on refetch', () => {
	assert.equal(audio.playSfxOnce('q:3:result', 'correct'), true);
	assert.equal(audio.playSfxOnce('q:3:result', 'correct'), false);
	assert.equal(audio.playSfxOnce('q:3:result', 'wrong'), false);
	assert.equal(audio.playSfxOnce('q:4:result', 'wrong'), true);
});

test('BGM does not restart between question/reveal/leaderboard', () => {
	assert.equal(audio.phaseForSessionStatus('question'), 'game');
	assert.equal(audio.phaseForSessionStatus('reveal'), 'game');
	assert.equal(audio.phaseForSessionStatus('leaderboard'), 'game');
	assert.equal(audio.phaseForSessionStatus('lobby'), 'lobby');
	assert.equal(audio.phaseForSessionStatus('finished'), 'off');

	assert.equal(audio.startBgm(true, 'party', 'game'), true);
	assert.equal(audio.wouldRestartBgm('party', 'game'), false);
	assert.equal(audio.startBgm(true, 'party', 'game'), false);
	assert.equal(audio.getActiveBgm()?.phase, 'game');
	audio.syncGameMusic(true, 'party', audio.phaseForSessionStatus('reveal'));
	assert.equal(audio.getActiveBgm()?.theme, 'party');
	assert.equal(audio.getActiveBgm()?.phase, 'game');
	audio.syncGameMusic(true, 'party', audio.phaseForSessionStatus('leaderboard'));
	assert.equal(audio.wouldRestartBgm('party', 'game'), false);
	assert.equal(audio.wouldRestartBgm('chill', 'game'), true);
});

test('preview switching keeps the latest theme and does not throw', async () => {
	audio.syncGameMusic(true, 'party', 'lobby');
	await audio.previewBgmTheme('arcade', 'game');
	await audio.previewBgmTheme('energy', 'lobby');
	assert.equal(audio.getActiveBgm()?.theme, 'energy');
});

test('legacy sfx packs normalize without changing BGM ids', () => {
	assert.equal(audio.normalizeSfxPack('carnival'), 'carnival');
	assert.equal(audio.normalizeSfxPack('soft'), 'soft');
	assert.equal(audio.normalizeSfxPack('unknown'), 'classic');
	assert.equal(audio.normalizeBgmTheme('energy'), 'energy');
	assert.equal(audio.normalizeBgmTheme('nope'), 'party');
	assert.equal(audio.DEFAULT_SFX_PACK, 'classic');
});

test('audio failure does not throw during playback helpers', () => {
	audio.setSfxMuted(false);
	assert.doesNotThrow(() => audio.playSfx('not-a-real-event'));
	assert.equal(audio.playSfx('not-a-real-event'), false);
	assert.doesNotThrow(() => audio.stopBgm({ immediate: true }));
	assert.doesNotThrow(() => audio.syncGameMusic(false, 'party', 'off'));
});
