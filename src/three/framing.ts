import * as THREE from 'three'

/**
 * Framing.
 *
 * A motorcycle is a long, low object, so the lens that frames it well depends
 * on the shape of the window it is being shown in. Every shot is authored with
 * a target framing size and a FOV stated for a 16:9 frame; this module converts
 * that into the number the camera actually needs so the machine sits in shot
 * with consistent margins, whether the window is a 32:9 monitor or a phone held
 * upright.
 */

/** Half-width of the reference frame at unit distance for a 16:9 window. */
const REF_ASPECT = 16 / 9

/**
 * Vertical FOV for the working window.
 *
 * Landscape windows keep the authored vertical framing, opening slightly for
 * ultra-wide displays. Portrait windows cannot: a 2.1 m machine has to fit
 * across the narrow side, so the lens opens until the horizontal field covers
 * the subject. Doing the work in the lens rather than by pulling the camera
 * back is what stops the product reading as a toy on a phone — the machine
 * fills the width of the screen instead of sitting in the middle of it.
 */
export function adaptFov(authoredFov: number, aspect: number): number {
  if (!Number.isFinite(aspect) || aspect <= 0.01) return authoredFov
  const vFovRef = THREE.MathUtils.degToRad(authoredFov)
  const hFovRef = 2 * Math.atan(Math.tan(vFovRef / 2) * REF_ASPECT)

  if (aspect >= 1) {
    const extra = Math.min(1, (aspect - REF_ASPECT) / 1.6)
    return authoredFov * (1 + 0.12 * extra)
  }

  // Hold the horizontal field while the window narrows.
  const hFovNeeded = 2 * Math.atan(Math.tan(hFovRef / 2) * (REF_ASPECT / Math.max(0.35, aspect)))
  const vFov = 2 * Math.atan(Math.tan(hFovNeeded / 2) / Math.max(0.3, aspect))
  return Math.min(THREE.MathUtils.radToDeg(vFov), authoredFov * 3.4)
}

/**
 * How much to widen a shot's authored distance.
 *
 * The lens does most of the work for portrait windows, so only a small amount
 * of extra distance is applied. Pulling back further would shrink the product
 * twice over, and on a phone the machine should command the width of the
 * screen rather than float in the middle of it.
 */
export function adaptDistance(aspect: number): number {
  if (aspect >= 1) return 1
  return 1 - Math.min(1, (1 - aspect) / 0.55) * 0.28
}
