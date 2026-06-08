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
