import * as THREE from 'three'

/**
 * Part registry.
 *
 * Each entry is a real group in the rig. The chapter-04 exploded view is not a
 * separate scene: every group simply owns an explode vector, a spin axis and a
 * screen-space anchor, and the exploded amount is one scrubbed 0..1 value that
 * multiplies the vector. Assembling and disassembling are the same code path.
 */
export type PartId =
  | 'frontWheel'
  | 'fork'
  | 'headlight'
  | 'cockpit'
  | 'swingarm'
  | 'rearWheel'
  | 'motor'
  | 'battery'
  | 'chassis'
  | 'bodywork'
  | 'seat'

export type PartDef = {
  id: PartId
  /** label rendered in the exploded-view annotation */
  label: string
  /** engineering annotation shown under the label */
  meta: string
  /** world-space anchor used for the callout leader line */
  anchor: [number, number, number]
  /** direction * distance of the exploded translation */
  explode: [number, number, number]
  /** extra rotation applied at full explosion (radians) */
  explodeRot: [number, number, number]
  /** z position of the light strip as it crosses this part during the reveal */
  revealZ: number
  /** fraction of the exploded amount this part travels (leaders take up slack) */
  gain?: number
  /** render order hint for the callout stack */
  side: 'left' | 'right'
}

/** Rake of the steering axis, in radians (25°). */
export const RAKE = THREE.MathUtils.degToRad(25)

/* ------------------------------------------------------------ hard points */

export const HARD = {
  frontAxle: new THREE.Vector3(0, 0.335, 0.7),
  rearAxle: new THREE.Vector3(0, 0.33, -0.68),
  swingPivot: new THREE.Vector3(0, 0.44, -0.11),
  steeringHead: new THREE.Vector3(0, 1.0, 0.383),
  wheelbase: 1.38,
}

export const PARTS: PartDef[] = [
  {
    id: 'frontWheel',
    label: 'Front wheel',
    meta: 'Ø 682 mm · forged aluminium',
    anchor: [0, 0.335, 0.7],
    explode: [0.62, 0.03, 0.16],
    explodeRot: [0, 0.35, 0],
    revealZ: 0.62,
    side: 'right',
  },
  {
    id: 'fork',
    label: 'Front assembly',
    meta: '48 mm TiN fork · radial monobloc',
    anchor: [0, 0.72, 0.62],
    explode: [0.42, 0.07, 0.3],
    explodeRot: [0, -0.18, 0.06],
    revealZ: 0.44,
    side: 'right',
  },
  {
    id: 'headlight',
    label: 'Lighting module',
    meta: 'Adaptive matrix LED',
    anchor: [0, 0.99, 0.6],
    explode: [0.24, 0.3, 0.52],
    explodeRot: [-0.25, 0, 0],
    revealZ: 0.36,
    side: 'right',
  },
  {
    id: 'cockpit',
    label: 'Cockpit',
    meta: '6.2" bonded TFT · haptic bars',
    anchor: [0, 1.03, 0.2],
    explode: [0.2, 0.66, 0.34],
    explodeRot: [0.4, 0, 0],
    revealZ: 0.3,
    side: 'right',
  },
  {
    id: 'bodywork',
    label: 'Bodywork',
    meta: 'Pre-preg carbon · 4 coats',
    anchor: [-0.24, 0.94, 0.1],
    explode: [-0.72, 0.24, 0.06],
    explodeRot: [0, 0.12, -0.16],
    revealZ: 0.14,
    side: 'left',
  },
  {
    id: 'chassis',
    label: 'Frame',
    meta: 'Bonded aluminium monocoque',
    anchor: [0, 0.72, -0.02],
    explode: [0, 0.82, -0.04],
    explodeRot: [0, 0, 0],
    revealZ: 0.06,
    side: 'right',
  },
  {
    id: 'battery',
    label: 'Battery',
    meta: '800 V · 120 kWh eq.',
    anchor: [0, 0.54, 0.05],
    explode: [0, -0.6, 0.12],
    explodeRot: [-0.12, 0, 0],
    revealZ: 0.0,
    side: 'left',
  },
  {
    id: 'motor',
    label: 'Drive unit',
    meta: '165 kW · oil-cooled',
    anchor: [0.2, 0.44, -0.24],
    explode: [0.46, -0.34, -0.44],
    explodeRot: [0, 0.3, 0],
    revealZ: -0.14,
    side: 'right',
  },
  {
    id: 'swingarm',
    label: 'Swingarm',
    meta: 'Cast + billet, underslung',
    anchor: [0, 0.4, -0.44],
    explode: [0, -0.18, -0.6],
    explodeRot: [0.1, 0, 0],
    revealZ: -0.26,
    side: 'right',
  },
  {
    id: 'rearWheel',
    label: 'Rear wheel',
    meta: 'Ø 664 mm · 200-section',
    anchor: [0, 0.33, -0.68],
    explode: [0.66, 0.05, -0.22],
    explodeRot: [0, -0.28, 0],
    revealZ: -0.5,
    side: 'left',
  },
  {
    id: 'seat',
    label: 'Tail section',
    meta: 'Structural composite seat unit',
    anchor: [0, 0.9, -0.4],
    explode: [0, 0.5, -0.66],
    explodeRot: [0.16, 0, 0],
    revealZ: -0.62,
    side: 'left',
  },
]

export const PART_BY_ID = Object.fromEntries(PARTS.map((p) => [p.id, p])) as Record<PartId, PartDef>

/** Convenience: a stable index for each part, used by the typed pose buffer. */
export const PART_INDEX = Object.fromEntries(PARTS.map((p, i) => [p.id, i])) as Record<PartId, number>
export const PART_COUNT = PARTS.length

/**
 * Base reveal offset handed to the sweep shader.
 *
 * The strip starts in front of the front wheel (z ≈ +1.15) and travels back
 * past the tail (z ≈ -1.1), so a part's offset is simply how far *ahead* of its
 * own position the strip must be before that part starts to appear. Local
 * offsets (~4 cm) then layer fine detail ordering on top of the global sweep.
 */
export const RELIEF_BASE = 0.86
export const RELIEF_SPAN = 0.13
export const RELIEF_JITTER = 0.04
export const reliefOf = (id: PartId) => {
  const d = PART_BY_ID[id]
  return RELIEF_BASE + RELIEF_SPAN * d.revealZ + RELIEF_JITTER * (d.anchor[0] > 0 ? 1 : 0)
}
