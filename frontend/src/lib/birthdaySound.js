import { getAudioContext, primeAudioContext, unlockNotificationAudio } from '@/lib/notificationSound';

// "Happy Birthday" melody in C major (public domain).
const MELODY = [
  { freq: 261.63, beats: 0.5 }, // C4
  { freq: 261.63, beats: 0.5 },
  { freq: 293.66, beats: 1 },   // D4
  { freq: 261.63, beats: 1 },
  { freq: 349.23, beats: 1 },   // F4
  { freq: 329.63, beats: 2 },   // E4
  { freq: 261.63, beats: 0.5 },
  { freq: 261.63, beats: 0.5 },
  { freq: 293.66, beats: 1 },
  { freq: 261.63, beats: 1 },
  { freq: 392.0, beats: 1 },    // G4
  { freq: 349.23, beats: 2 },
  { freq: 261.63, beats: 0.5 },
  { freq: 261.63, beats: 0.5 },
  { freq: 523.25, beats: 1 },   // C5
  { freq: 440.0, beats: 1 },    // A4
  { freq: 349.23, beats: 1 },
  { freq: 329.63, beats: 1 },
  { freq: 293.66, beats: 2 },
  { freq: 466.16, beats: 0.5 }, // Bb4
  { freq: 466.16, beats: 0.5 },
  { freq: 440.0, beats: 1 },
  { freq: 349.23, beats: 1 },
  { freq: 392.0, beats: 1 },
  { freq: 349.23, beats: 2 },
];

const BEAT_SECONDS = 0.38;
const LOOP_PAUSE_SECONDS = 1.2;
const VOLUME = 0.18;

let playbackToken = 0;
let activeNodes = [];
let loopTimer = null;

function clearActiveNodes() {
  activeNodes.forEach(({ oscillator, gain, stopAt }) => {
    try {
      oscillator.stop(stopAt);
    } catch {
      // Already stopped.
    }
    try {
      gain.disconnect();
      oscillator.disconnect();
    } catch {
      // Ignore disconnect errors.
    }
  });
  activeNodes = [];
}

function scheduleMelody(context, token, startTime) {
  let cursor = startTime;

  MELODY.forEach(({ freq, beats }) => {
    if (token !== playbackToken) return;

    const duration = beats * BEAT_SECONDS;
    const noteStart = cursor;
    const noteEnd = noteStart + duration - 0.04;

    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, noteStart);
    gain.gain.exponentialRampToValueAtTime(VOLUME, noteStart + 0.03);
    gain.gain.setValueAtTime(VOLUME * 0.85, noteEnd - 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(noteStart);
    oscillator.stop(noteEnd + 0.05);

    activeNodes.push({ oscillator, gain, stopAt: noteEnd + 0.05 });
    cursor += duration;
  });

  return cursor;
}

function scheduleLoop(context, token, melodyEndTime) {
  if (token !== playbackToken) return;

  loopTimer = setTimeout(() => {
    if (token !== playbackToken) return;
    const nextStart = context.currentTime + 0.05;
    const nextEnd = scheduleMelody(context, token, nextStart);
    scheduleLoop(context, token, nextEnd);
  }, Math.max(0, (melodyEndTime - context.currentTime) * 1000) + LOOP_PAUSE_SECONDS * 1000);
}

export function stopBirthdaySong() {
  playbackToken += 1;

  if (loopTimer) {
    clearTimeout(loopTimer);
    loopTimer = null;
  }

  clearActiveNodes();
}

export async function playBirthdaySong({ fromUserGesture = false } = {}) {
  const context = getAudioContext();
  if (!context) return false;

  if (fromUserGesture) {
    primeAudioContext();
  }

  const ready = await unlockNotificationAudio();
  if (!ready) return false;

  stopBirthdaySong();
  const token = playbackToken;

  try {
    const start = context.currentTime + 0.05;
    const melodyEnd = scheduleMelody(context, token, start);
    scheduleLoop(context, token, melodyEnd);
    return true;
  } catch {
    stopBirthdaySong();
    return false;
  }
}
