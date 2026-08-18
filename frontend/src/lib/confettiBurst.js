import confetti from 'canvas-confetti';

const COLORS = ['#ff6b9d', '#ffc93c', '#6bcb77', '#4d96ff', '#c77dff', '#ff922b'];

export function fireBirthdayConfetti() {
  const duration = 2800;
  const end = Date.now() + duration;

  confetti({
    particleCount: 120,
    spread: 80,
    startVelocity: 42,
    origin: { y: 0.55 },
    colors: COLORS,
    zIndex: 9999,
  });

  const frame = () => {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 62,
      origin: { x: 0, y: 0.55 },
      colors: COLORS,
      zIndex: 9999,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 62,
      origin: { x: 1, y: 0.55 },
      colors: COLORS,
      zIndex: 9999,
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  };

  frame();
}

/** Small burst for a correct answer */
export function fireCorrectConfetti() {
  confetti({
    particleCount: 48,
    spread: 62,
    startVelocity: 28,
    origin: { y: 0.7 },
    colors: COLORS,
    zIndex: 9999,
  });
}

/** Bigger burst for streak milestones */
export function fireStreakConfetti() {
  confetti({
    particleCount: 70,
    spread: 75,
    startVelocity: 34,
    origin: { y: 0.65 },
    colors: COLORS,
    zIndex: 9999,
  });
}

/** Side cannons for reveal / leaderboard moments */
export function fireCelebrateConfetti() {
  confetti({
    particleCount: 55,
    angle: 60,
    spread: 55,
    origin: { x: 0, y: 0.65 },
    colors: COLORS,
    zIndex: 9999,
  });
  confetti({
    particleCount: 55,
    angle: 120,
    spread: 55,
    origin: { x: 1, y: 0.65 },
    colors: COLORS,
    zIndex: 9999,
  });
}

/** Finale for game / test complete */
export function fireWinnerConfetti() {
  const end = Date.now() + 1800;
  confetti({
    particleCount: 100,
    spread: 90,
    startVelocity: 40,
    origin: { y: 0.55 },
    colors: COLORS,
    zIndex: 9999,
  });
  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 50,
      origin: { x: 0, y: 0.6 },
      colors: COLORS,
      zIndex: 9999,
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 50,
      origin: { x: 1, y: 0.6 },
      colors: COLORS,
      zIndex: 9999,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
}
