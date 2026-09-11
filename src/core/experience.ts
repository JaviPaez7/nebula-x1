import * as THREE from 'three'
import { at } from './chapters'
import { clamp, lerp, smoothstep } from './math'
import { PART_COUNT, PART_INDEX, PARTS, type PartId } from '../three/bikeParts'

/**
 * The experience state.
 *
 * Every channel in the film — camera, machine attitude, part separation,
 * lighting, atmosphere, particle intensity, UI — is a pure function of one
 * number: scroll progress. There is no event system, no "has this played yet"
 * bookkeeping and no direction flag, which is precisely why scrolling
 * backwards rewinds the film perfectly: the same function is simply evaluated
 * at a smaller input.
 */

/* ------------------------------------------------------------- channels */

export type Channel =
  | 'worldVisible'
  | 'worldOpacity'
  | 'reveal'
  | 'explode'
  | 'bikeRotY'
  | 'bikeRotX'
  | 'bikeOffsetY'
  | 'bikeOffsetZ'
  | 'bikeLift'
  | 'spin'
  | 'wheelSpin'
  | 'lightKey'
  | 'lightRim'
  | 'lightBack'
  | 'lightWash'
  | 'lightFill'
  | 'lightAccentFront'
  | 'lightAccentRear'
  | 'lightHead'
  | 'lightTail'
  | 'backdropGlow'
  | 'fog'
  | 'airflow'
  | 'airSpeed'
  | 'energy'
  | 'dust'
  | 'dustSpread'
  | 'exposure'
  | 'grain'
  | 'vignette'
  | 'speedSmear'
  | 'shake'
  | 'batteryCore'
  | 'rotorOut'
  | 'timeScale'
  | 'cockpit'
  | 'specsReveal'
  | 'floorScroll'

export type ExperienceState = Record<Channel, number>

export function createState(): ExperienceState {
  return {
    worldVisible: 1,
    worldOpacity: 0,
    reveal: 0,
    explode: 0,
    bikeRotY: -0.3,
    bikeRotX: 0,
    bikeOffsetY: 0,
    bikeOffsetZ: 0,
    bikeLift: 0,
    spin: 0,
    wheelSpin: 0,
    lightKey: 0,
    lightRim: 0,
    lightBack: 0,
    lightWash: 0,
    lightFill: 0,
    lightAccentFront: 0,
    lightAccentRear: 0,
    lightHead: 0,
    lightTail: 0,
    backdropGlow: 0,
    fog: 0.04,
    airflow: 0,
    airSpeed: 1.2,
    energy: 0,
    dust: 0,
    dustSpread: 0.2,
    exposure: 0.82,
    grain: 0.055,
    vignette: 0.8,
    speedSmear: 0,
    shake: 0,
    batteryCore: 0,
    rotorOut: 0,
    timeScale: 1,
    cockpit: 0,
    specsReveal: 0,
    floorScroll: 0,
  }
}

/** Per-part separation vectors, resolved once. */
const EXPLODE = PARTS.map((p) => new THREE.Vector3(p.explode[0], p.explode[1], p.explode[2]))
const EXPLODE_ROT = PARTS.map(
  (p) => new THREE.Euler(p.explodeRot[0], p.explodeRot[1], p.explodeRot[2]),
)

/** Stagger: parts leave in sequence rather than all at once. */
const BAND = 0.2
const STAGGER = 0.09
const RELEASE = PARTS.map((_, i) => i * STAGGER)
const RETURN = RELEASE.map((v) => (PART_COUNT - 1) * STAGGER - v)

/**
 * Extra per-chapter pose tweaks layered on top of the exploded offsets.
 * Written into a reusable object so nothing allocates during the film.
 */
export const PART_ANCHORS = PARTS.map((pt) => new THREE.Vector3(pt.anchor[0], pt.anchor[1], pt.anchor[2]))
export const PART_LABELS = PARTS.map((pt) => ({ label: pt.label, meta: pt.meta, side: pt.side }))

export const partOffset = {
  v: Array.from({ length: PART_COUNT }, () => new THREE.Vector3()),
  r: Array.from({ length: PART_COUNT }, () => new THREE.Euler()),
}

/**
 * Test whether chapter `i` is the active one at progress `p`, returning a
 * shaped 0..1 envelope. Used for chapter-specific flourishes.
 */
function band(p: number, start: number, end: number) {
  return smoothstep(start, end, p)
}

/* --------------------------------------------------------------- signal */

export function evaluate(p: number, out: ExperienceState, velocity: number, elapsed: number) {
  /* ── global curtain ──────────────────────────────────────────────────── */
  out.worldOpacity = smoothstep(0, 0.006, p)
  out.worldVisible = 1

  /* ── chapter 02: the strip of light ──────────────────────────────────── */
  // Starts before the front wheel and finishes behind the tail, so the light
  // genuinely travels the length of the machine.
  out.reveal = lerp(0.13, 1.28, smoothstep(at('introduction', 0.28), at('reveal', 0.86), p))

  /* ── chapter 04-07: composition ──────────────────────────────────────── */
  const out4 = smoothstep(at('exploded', 0.12), at('exploded', 0.95), p)
  const back7 = 1 - smoothstep(at('aerodynamics', 0.16), at('aerodynamics', 0.82), p)
  out.explode = Math.min(out4, back7)
  out.batteryCore = smoothstep(0.25, 0.85, out.explode)
  out.rotorOut = smoothstep(0.45, 1.0, out.explode)

  /* ── machine attitude ────────────────────────────────────────────────── */
  // A slow turn through the reveal, then square to the side for airflow.
  const yawIn = smoothstep(at('introduction', 0.3), at('reveal', 0.5), p)
  const yawSquare = smoothstep(at('motor', 0.6), at('aerodynamics', 0.6), p)
  out.bikeRotY = lerp(-0.34, -0.06, yawIn) * (1 - yawSquare) + 0.0 * yawSquare

  // A brief nose-down/pitch-up flourish as the drive unit is examined.
  out.bikeRotX =
    0.05 * smoothstep(at('performance', 0.3), at('performance', 0.8), p) * (1 - smoothstep(at('exploded', 0.2), at('exploded', 0.7), p))

  /* ── chapter 11: ride ────────────────────────────────────────────────── */
  const launch = smoothstep(at('ride', 0.06), at('ride', 0.5), p)
  const settle = smoothstep(at('ride', 0.86), at('finale', 0.2), p)
  const ride = launch * (1 - settle)
  out.bikeLift = ride * 0.055
  out.bikeOffsetY = out.bikeLift
  out.bikeOffsetZ = smoothstep(at('ride', 0.1), at('ride', 0.9), p) * 0.05 * (1 - settle)
  // Torque reaction: the machine squats under power and rotates the wheel.
  out.bikeRotX += -0.045 * ride
  out.wheelSpin = smoothstep(at('ride', 0.08), at('ride', 1.0), p) * 46 + out.explode * 0
  out.spin = smoothstep(at('battery', 0.35), at('motor', 1.0), p) * 14 // drive unit rotation
  out.shake = ride * 0.022 + clamp(Math.abs(velocity) * 3.2, 0, 1) * 0.006
  out.floorScroll = smoothstep(at('ride', 0.02), at('finale', 0.35), p) * 26
  out.speedSmear = ride * 0.85
  out.dust = ride * 0.9
  out.dustSpread = 0.16 + ride * 0.5

  /* ── lighting desk ───────────────────────────────────────────────────── */
  const darkRoom = 1 - smoothstep(at('lighting', 0.05), at('lighting', 0.55), p)
  const studioUp = smoothstep(at('introduction', 0.5), at('reveal', 0.9), p)
  const dip = 1 - 0.5 * smoothstep(at('battery', 0.5), at('motor', 0.5), p) * (1 - smoothstep(at('aerodynamics', 0.4), at('aerodynamics', 0.9), p))
  const finaleUp = smoothstep(at('finale', 0.1), at('finale', 0.55), p)

  // Levels are set against the studio reference in `beauty.ts`: a fully lit
  // chapter should land at roughly key 58 / rim 38 / back 22 / wash 32, which
  // is what makes the machine legible on a large, bright display without the
  // room ever going grey.
  out.lightKey = (0.42 + 1.02 * studioUp) * dip * darkRoom * (1 + 0.22 * finaleUp)
  out.lightRim = (0.26 + 0.86 * studioUp) * (0.55 + 0.45 * dip) * darkRoom
  out.lightBack = (0.12 + 0.44 * studioUp) * (0.45 + 0.55 * darkRoom)
  out.lightWash = (0.24 + 1.0 * smoothstep(at('reveal', 0.3), at('performance', 0.6), p)) * darkRoom * (1 + 0.18 * finaleUp)
  out.backdropGlow = (0.06 + 0.72 * smoothstep(at('reveal', 0.2), at('performance', 0.8), p)) * (0.45 + 0.55 * darkRoom)

  /* ── internal practicals ─────────────────────────────────────────────── */
  out.lightFill = smoothstep(at('battery', 0.25), at('battery', 0.8), p) * (1 - smoothstep(at('motor', 0.4), at('aerodynamics', 0.5), p))
  out.energy = 0.85 * smoothstep(at('battery', 0.32), at('battery', 0.75), p) * (1 - smoothstep(at('motor', 0.3), at('motor', 0.9), p))
  out.lightAccentFront = smoothstep(at('motor', 0.6), at('aerodynamics', 0.3), p) * (1 - smoothstep(at('ride', 0.2), at('finale', 0.6), p))
  out.lightAccentRear = smoothstep(at('performance', 0.4), at('performance', 0.95), p) * (1 - smoothstep(at('battery', 0.4), at('motor', 0.6), p))

  /* ── chapter 09: signature lighting ──────────────────────────────────── */
  const head = smoothstep(at('lighting', 0.22), at('lighting', 0.66), p)
  const tail = smoothstep(at('lighting', 0.42), at('lighting', 0.86), p)
  const accents = smoothstep(at('lighting', 0.6), at('lighting', 1.0), p)
  // A slow flicker as the LED driver finds its operating point.
  const flicker = 1 - 0.35 * Math.exp(-6 * elapsed) * Math.max(0, Math.sin(elapsed * 34))
  out.lightHead = head * flicker * (1 - 0.35 * ride)
  out.lightTail = tail * flicker * (1 + 0.2 * ride)
  out.lightWash += 0.22 * accents

  /* ── chapter 07: airflow ─────────────────────────────────────────────── */
  const aero = smoothstep(at('aerodynamics', 0.22), at('aerodynamics', 0.6), p) * (1 - smoothstep(at('materials', 0.1), at('materials', 0.5), p))
  out.airflow = aero
  out.airSpeed = 1.1 + 2.6 * aero + ride * 9 + clamp(Math.abs(velocity) * 26, 0, 3)

  /* ── atmosphere ──────────────────────────────────────────────────────── */
  out.fog = lerp(0.035, 0.16, studioUp) * (0.7 + 0.3 * darkRoom) + ride * 0.42 + aero * 0.04

  /* ── chapter 10: cockpit ─────────────────────────────────────────────── */
  out.cockpit = band(p, at('cockpit', 0.12), at('cockpit', 0.4)) * (1 - smoothstep(at('ride', 0.5), at('finale', 0.15), p))

  /* ── grade ───────────────────────────────────────────────────────────── */
  out.exposure = 0.88 + 0.4 * studioUp + 0.1 * finaleUp - 0.1 * (1 - darkRoom)
  out.grain = lerp(0.075, 0.032, studioUp)
  out.vignette = lerp(0.92, 0.66, studioUp) + ride * 0.06
  out.timeScale = 1

  /* ── finale specs ────────────────────────────────────────────────────── */
  out.specsReveal = smoothstep(at('finale', 0.3), at('finale', 0.75), p)
}

/* ---------------------------------------------------- per-part transform */

const _v = new THREE.Vector3()

/**
 * Compute and apply the separation transform for one part.
 * `explode` is global; per-part stagger comes from RELEASE/RETURN.
 */
export function applyPartTransform(
  i: number,
  explode: number,
  side: number,
  t: number,
  extra?: Partial<Record<PartId, THREE.Vector3>>,
) {
  const local = clamp((explode - RELEASE[i]) / BAND) * clamp((explode - RETURN[i]) / BAND)
  const dir = EXPLODE[i]
  const rot = EXPLODE_ROT[i]
  _v.copy(dir).multiplyScalar(local)

  // A whisper of floating motion so the separated cluster feels suspended
  // rather than pasted onto the screen.
  const drift = local * 0.012
  const phase = i * 1.7
  _v.x += Math.sin(t * 0.42 + phase) * drift
  _v.y += Math.cos(t * 0.37 + phase * 1.3) * drift

  partOffset.v[i].copy(_v)
  partOffset.r[i].set(rot.x * local, rot.y * local, rot.z * local)

  const e = extra?.[PARTS[i].id]
  if (e) partOffset.v[i].add(e)
  void side
}

export function partIndex(id: PartId) {
  return PART_INDEX[id]
}

/**
 * The machine's own transform, published once per frame.
 *
 * Both the director and the DOM callout layer read this, which is what keeps
 * the projected annotation anchors welded to the separated hardware instead of
 * drifting behind it.
 */
export const machineMatrix = new THREE.Matrix4()
const _q = new THREE.Quaternion()

export function updateMachineMatrix(rotX: number, rotY: number, y: number, z: number) {
  _q.setFromEuler(new THREE.Euler(rotX, rotY, 0, 'XYZ'))
  machineMatrix.compose(new THREE.Vector3(0, y, z), _q, new THREE.Vector3(1, 1, 1))
}

/** World-space position of a part's annotation anchor, including separation. */
const _anchor = new THREE.Vector3()
const _off = new THREE.Vector3()
export function anchorWorld(i: number, out: THREE.Vector3) {
  _anchor.copy(PART_ANCHORS[i])
  _off.copy(partOffset.v[i])
  if (partOffset.r[i].x !== 0 || partOffset.r[i].y !== 0 || partOffset.r[i].z !== 0) {
    _off.applyEuler(partOffset.r[i])
  }
  out.copy(_anchor).add(_off).applyMatrix4(machineMatrix)
  return out
}

