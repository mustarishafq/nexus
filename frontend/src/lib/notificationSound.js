let audioContext = null;
let unlockListenersAttached = false;

export function getAudioContext() {
  if (typeof window === 'undefined') {
    return null;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioContextClass();
  }

  return audioContext;
}

function playSilentUnlockTone(context) {
  const buffer = context.createBuffer(1, 1, 22050);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.start(0);
}

/** Call synchronously inside a user gesture (tap/click) to unlock iOS audio. */
export function primeAudioContext() {
  const context = getAudioContext();
  if (!context) {
    return false;
  }

  try {
    playSilentUnlockTone(context);
    if (context.state === 'suspended') {
      void context.resume();
    }
    return true;
  } catch {
    return false;
  }
}

export function isNotificationAudioReady() {
  const context = getAudioContext();
  return context?.state === 'running';
}

export async function unlockNotificationAudio() {
  const context = getAudioContext();
  if (!context) {
    return false;
  }

  try {
    if (context.state !== 'running') {
      playSilentUnlockTone(context);
    }

    if (context.state === 'suspended') {
      await context.resume();
    }

    return context.state === 'running';
  } catch {
    return false;
  }
}

export function setupNotificationAudioUnlock() {
  if (unlockListenersAttached || typeof window === 'undefined') {
    return;
  }

  unlockListenersAttached = true;

  const unlock = () => {
    primeAudioContext();
    void unlockNotificationAudio();
  };

  window.addEventListener('pointerdown', unlock, { once: true, passive: true });
  window.addEventListener('keydown', unlock, { once: true });
  window.addEventListener('touchstart', unlock, { once: true, passive: true });
}

export async function playNotificationSound() {
  const context = getAudioContext();
  if (!context) {
    return false;
  }

  try {
    const ready = await unlockNotificationAudio();
    if (!ready) {
      return false;
    }

    const start = context.currentTime;
    const tones = [
      { frequency: 880, offset: 0 },
      { frequency: 1174.66, offset: 0.13 },
    ];

    tones.forEach(({ frequency, offset }) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.25, start + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.22);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start + offset);
      oscillator.stop(start + offset + 0.24);
    });

    return true;
  } catch {
    return false;
  }
}
