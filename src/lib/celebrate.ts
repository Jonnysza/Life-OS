"use client";

import confetti from "canvas-confetti";

export function celebrate(color?: string) {
  const colors = color
    ? [color, color, "#ffffff"]
    : ["#8b5cf6", "#6366f1", "#ec4899", "#f97316", "#10b981"];

  confetti({
    particleCount: 90,
    spread: 75,
    startVelocity: 35,
    origin: { y: 0.7 },
    colors,
    ticks: 160,
    scalar: 0.9,
  });
  setTimeout(() => {
    confetti({
      particleCount: 40,
      spread: 90,
      startVelocity: 25,
      origin: { y: 0.7, x: 0.3 },
      colors,
    });
    confetti({
      particleCount: 40,
      spread: 90,
      startVelocity: 25,
      origin: { y: 0.7, x: 0.7 },
      colors,
    });
  }, 120);
}

export function celebrateBig(color?: string) {
  celebrate(color);
  setTimeout(() => celebrate(color), 250);
  setTimeout(() => celebrate(color), 500);
}
