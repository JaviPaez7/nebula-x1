import { clamp } from './math'

/**
 * The caption timeline.
 *
 * One rail carries the whole film. Every text block is authored with an
 * absolute timecode, exactly like a subtitle track, and is rendered as a
 * continuous function of scroll progress. Because there is no "on enter"
 * trigger anywhere, reversing the scroll reverses every reveal, and stopping
 * mid-motion freezes the frame — which is what real scrubbing means.
 */

export type Timing =
  | number
  | {
      /** timecode the element is fully on screen (absolute, 0..1) */
      at: number
      /** length of the reveal */
      rise?: number
      /** length of the exit */
      fall?: number
    }

export type Resolved = { start: number; end: number; peakStart: number; peakEnd: number }

export function resolve(timing: Timing, span = 0.02): Resolved {
  const at = typeof timing === 'number' ? timing : timing.at
  const rise = typeof timing === 'number' ? span : (timing.rise ?? span)
  const fall = typeof timing === 'number' ? span * 1.4 : (timing.fall ?? span * 1.4)
  return { start: at - rise, peakStart: at, peakEnd: at + rise * 0.2, end: at + rise * 0.2 + fall }
}

const smooth = (t: number) => t * t * (3 - 2 * t)

/** Opacity envelope: 0 before, 1 across the plateau, 0 after. */
export function envelope(p: number, r: Resolved): number {
  if (p <= r.start || p >= r.end) return 0
  if (p < r.peakStart) return smooth(clamp((p - r.start) / Math.max(1e-5, r.peakStart - r.start)))
  if (p <= r.peakEnd) return 1
  return 1 - smooth(clamp((p - r.peakEnd) / Math.max(1e-5, r.end - r.peakEnd)))
}

/**
 * Signed travel: -1 before the element's moment, 0 at rest, +1 after it.
 * Drives direction-aware motion (a heading that slides up as it leaves) with
 * no extra state.
 */
export function travel(p: number, r: Resolved): number {
  if (p < r.peakStart) return -1 + smooth(clamp((p - r.start) / Math.max(1e-5, r.peakStart - r.start)))
  if (p <= r.peakEnd) return 0
  return smooth(clamp((p - r.peakEnd) / Math.max(1e-5, r.end - r.peakEnd)))
}

/** Apply an envelope to a DOM node as CSS custom properties. */
export function applyScrub(
  el: HTMLElement,
  p: number,
  timing: Timing,
  opts: { span?: number; distance?: number; scale?: number; blur?: number } = {},
) {
  const r = resolve(timing, opts.span ?? 0.018)
  const o = envelope(p, r)
  const trav = travel(p, r)
  el.style.setProperty('--o', o.toFixed(4))
  el.style.setProperty('--t', trav.toFixed(4))
  el.style.setProperty('--d', String(opts.distance ?? 30))
  el.style.setProperty('--sc', String(opts.scale ?? 1))
  el.style.setProperty('--bl', String(opts.blur ?? 8))
  el.style.setProperty('--vis', o > 0.002 ? 'visible' : 'hidden')
  el.style.pointerEvents = o > 0.5 ? 'auto' : 'none'
}

/** Reduced-motion variant: content is either present or not, never animated. */
export function applyStatic(el: HTMLElement) {
  el.style.setProperty('--o', '1')
  el.style.setProperty('--t', '0')
  el.style.setProperty('--vis', 'visible')
}
