"use client";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return ctx;
}

function tone(freq: number, durationMs: number, when = 0, type: OscillatorType = "sine", gain = 0.08) {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(g);
  g.connect(c.destination);
  const t0 = c.currentTime + when;
  const t1 = t0 + durationMs / 1000;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t1);
  osc.start(t0);
  osc.stop(t1 + 0.05);
}

export function soundCheck() {
  tone(880, 80);
  tone(1320, 120, 0.04);
}

export function soundGoal() {
  tone(523, 100, 0);
  tone(659, 100, 0.08);
  tone(784, 200, 0.16);
}

export function soundError() {
  tone(220, 120, 0, "square", 0.04);
}

export function soundTick() {
  tone(660, 30, 0, "triangle", 0.03);
}

export function soundBell() {
  tone(880, 250, 0, "sine", 0.1);
  tone(1318, 350, 0.05, "sine", 0.08);
  tone(1760, 400, 0.1, "sine", 0.06);
}
