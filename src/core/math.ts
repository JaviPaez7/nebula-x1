/**
 * Small deterministic math helpers used across the experience.
 * Everything here is allocation-free so it is safe to call inside the render loop.
 */

export const clamp = (v: number, min = 0, max = 1): number => (v < min ? min : v > max ? max : v)

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/** Inverse lerp, clamped to 0..1 */
export const invLerp = (a: number, b: number, v: number): number =>
  a === b ? (v < a ? 0 : 1) : clamp((v - a) / (b - a))

/** Hermite smoothstep between two edges. */
export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = invLerp(edge0, edge1, x)
  return t * t * (3 - 2 * t)
}

/** Quintic smootherstep — nicer for camera moves that start and end at rest. */
export const smootherstep = (edge0: number, edge1: number, x: number): number => {
  const t = invLerp(edge0, edge1, x)
  return t * t * t * (t * (t * 6 - 15) + 10)
}

/** Ease-out cubic, for things that should decelerate into place. */
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3)

/** Ease-in-out cubic. */
export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

/**
 * Frame-rate independent exponential smoothing ("damping").
 * Moves `current` toward `target` at a rate defined by `lambda` (higher = snappier).
 */
export const damp = (current: number, target: number, lambda: number, dt: number): number =>
  lerp(current, target, 1 - Math.exp(-lambda * dt))

/** Map a value from one range to another with clamping. */
export const remap = (v: number, inMin: number, inMax: number, outMin: number, outMax: number): number =>
  lerp(outMin, outMax, invLerp(inMin, inMax, v))

/** Deterministic pseudo-random in [0,1) from an integer seed. */
export const hash01 = (n: number): number => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123
  return s - Math.floor(s)
}

/** Compact number formatting used by the HUD. */
export const pad = (n: number, len = 2): string => String(Math.round(n)).padStart(len, '0')
