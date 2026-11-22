// A tiny seeded random generator (mulberry32) so a floor, a patrol jitter or
// a screenshot scene is the same every time the same seed is used — plus the
// small math helpers the whole game shares, and the stutter that makes the
// Blackout Mode lights fail unevenly instead of all at once.

// mulberry32: a small, fast seeded generator with a full 32-bit state.
export function makeRandom(seed) {
  let state = (seed >>> 0) || 1;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return next;
}

// A value in [lo, hi) from a next() stream.
export function randRange(next, lo, hi) {
  return lo + (hi - lo) * next();
}

// Pin value into [lo, hi].
export function clamp(value, lo, hi) {
  if (value < lo) return lo;
  if (value > hi) return hi;
  return value;
}

// Straight-line blend between a and b.
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Smallest signed difference between two angles, in (-PI, PI].
export function angleDelta(from, to) {
  const TAU = Math.PI * 2;
  let d = (to - from) % TAU;
  if (d > Math.PI) d -= TAU;
  else if (d < -Math.PI) d += TAU;
  return d;
}

// Straight-line distance between two points.
export function distance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.hypot(dx, dy);
}

// A smooth 0..1 wobble that never jumps: layered sines at unrelated speeds,
// so the blackout veil's flicker feels like failing lights, not a strobe.
export function flickerNoise(t) {
  const slow = Math.sin(t * 1.7) * 0.5 + 0.5;
  const fast = Math.sin(t * 7.3 + 1.3) * 0.5 + 0.5;
  const ragged = Math.sin(t * 13.1 + 4.1) * 0.5 + 0.5;
  return slow * 0.55 + fast * 0.3 + ragged * 0.15;
}

// A loot glow's pulse: a gentle breathing scale around 1, driven by the
// clock and the item's own position so neighbouring loot never pulses in
// step. amp is how far the scale swings either side of 1.
export function glowPulse(t, seed, amp) {
  return 1 + Math.sin(t * 3 + seed) * amp;
}

// A cheap 1-D value-noise in [0, 1): hash the integer cell, blend to the
// next cell, so a value changes smoothly as t drifts across whole seconds.
export function driftNoise(t) {
  const cell = Math.floor(t);
  const frac = t - cell;
  const a = hashCell(cell);
  const b = hashCell(cell + 1);
  const smooth = frac * frac * (3 - 2 * frac);
  return a + (b - a) * smooth;
}

function hashCell(n) {
  let h = (n * 374761393 + 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
