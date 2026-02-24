/**
 * Math utilities.
 *
 * Pure functions — no side effects, no DOM, no imports.
 * Used by the breathing engine and circle animation.
 */

/**
 * Linear interpolation between `a` and `b` by factor `t`.
 * When t=0 returns a, when t=1 returns b.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Clamp `value` between `min` and `max` (inclusive).
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Map a value from one range to another.
 * E.g., remap(0.5, 0, 1, 100, 200) → 150.
 */
export function remap(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  const t = (value - inMin) / (inMax - inMin);
  return lerp(outMin, outMax, t);
}

/**
 * Compute an ease-in-out curve (smoothstep) for t in [0, 1].
 * Produces a smoother animation feel than linear interpolation.
 */
export function easeInOut(t: number): number {
  const clamped = clamp(t, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}
