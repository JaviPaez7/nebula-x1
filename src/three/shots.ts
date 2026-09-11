import * as THREE from 'three'
import { at } from '../core/chapters'
import { smootherstep } from '../core/math'
import { adaptDistance, adaptFov } from './framing'

/**
 * The shot list.
 *
 * This is a real camera department: a list of framed shots, each with a
 * position, a point of interest, a focal length and an optional roll. Scroll
 * progress is the timecode. Between two shots the camera travels along a
 * smoothed spline while its aim eases across, which is why the film never cuts
 * — it just keeps moving.
 */
export type Shot = {
  t: number
  /** camera position */
  p: [number, number, number]
  /** point the camera is aimed at */
  target: [number, number, number]
  /** vertical field of view, degrees, authored for a 16:9 window */
  fov: number
  /** roll around the view axis, degrees */
  roll?: number
  /**
   * How much of the machine must stay in frame. 0 means "let it bleed off the
   * edge" (macro and detail shots), 1 means "everything fits with a margin".
   */
  hold?: number
}

const S = (
  chapter: string,
  local: number,
  p: [number, number, number],
  target: [number, number, number],
  fov: number,
  roll = 0,
  hold = 1,
): Shot => ({ t: at(chapter, local), p, target, fov, roll, hold })

export const SHOTS: Shot[] = [
  // ── 01 Introduction ────────────────────────────────────────────────────
  // Almost nothing. A faint edge of the machine, far away, on a long lens.
  S('introduction', 0.0, [5.4, 2.6, 6.0], [0, 0.6, 0], 24),
  S('introduction', 0.55, [4.7, 2.05, 5.1], [0, 0.6, 0.02], 25),
  S('introduction', 1.0, [4.05, 1.8, 4.3], [0, 0.6, 0.04], 26, -0.5),

  // ── 02 Full reveal ─────────────────────────────────────────────────────
  // A slow arc around the front while the strip of light uncovers the bike.
  S('reveal', 0.3, [3.4, 1.55, 3.5], [0, 0.58, 0.06], 27, -1),
  S('reveal', 0.62, [3.05, 1.24, 2.95], [0, 0.56, 0.05], 28, -1.4),
  S('reveal', 1.0, [2.8, 1.1, 2.5], [0, 0.54, 0.02], 29, -1.6),

  // ── 03 Performance ─────────────────────────────────────────────────────
  // Down and back onto the drive unit. Long lens, subject compressed.
  S('performance', 0.34, [2.9, 1.35, 1.3], [0, 0.5, -0.2], 28, -1.5, 0.85),
  S('performance', 0.72, [3.15, 0.98, 0.05], [0, 0.44, -0.32], 30, -1.2, 0.85),
  S('performance', 1.0, [3.3, 0.78, -0.7], [0, 0.4, -0.44], 32, -0.9, 0.85),

  // ── 04 Exploded view ───────────────────────────────────────────────────
  // Pull out and up: the machine comes apart in front of a widening lens.
  S('exploded', 0.34, [5.6, 1.5, -1.9], [0, 0.54, -0.3], 42, -0.5),
  S('exploded', 0.68, [6.6, 2.5, -0.7], [0, 0.6, -0.18], 46, 0),
  S('exploded', 1.0, [7.2, 2.9, 0.3], [0, 0.62, -0.1], 47, 0.4),

  // ── 05 Battery ─────────────────────────────────────────────────────────
  // Travel into the machine and settle on a technical section.
  S('battery', 0.34, [5.4, 2.4, 0.6], [0, 0.56, 0.0], 42, 0.3),
  S('battery', 0.7, [3.3, 1.6, 0.4], [0, 0.52, 0.04], 40, 0.35),
  S('battery', 1.0, [2.5, 1.16, 0.24], [0, 0.5, 0.06], 42, 0.5),

  // ── 06 Motor ───────────────────────────────────────────────────────────
  S('motor', 0.36, [1.95, 0.86, -0.25], [0, 0.46, -0.18], 41, 0.7),
  S('motor', 0.72, [1.72, 0.64, -0.6], [0, 0.43, -0.32], 43, 0.9),
  S('motor', 1.0, [1.68, 0.58, -0.86], [0, 0.42, -0.36], 44, 1.1),

  // ── 07 Aerodynamics ────────────────────────────────────────────────────
  // Reassemble, swing out to a clean side profile, then drift back.
  S('aerodynamics', 0.3, [2.5, 1.0, -0.5], [0, 0.5, -0.22], 40, 0.8),
  S('aerodynamics', 0.66, [3.6, 0.9, -0.7], [0, 0.58, -0.14], 32, 0.2),
  S('aerodynamics', 1.0, [3.95, 1.02, -0.95], [0, 0.6, -0.05], 31, 0),

  // ── 08 Materials ───────────────────────────────────────────────────────
  // Extreme macro. The camera gets closer than a lens should — these are the
  // only shots allowed to let the machine run off the edge of frame.
  S('materials', 0.3, [0.72, 0.9, 1.02], [0.1, 0.66, 0.52], 22, 0, 0),
  S('materials', 0.52, [-0.46, 0.98, 0.24], [-0.19, 0.88, 0.06], 21, 0, 0),
  S('materials', 0.7, [0.5, 1.16, 0.24], [0.06, 0.9, 0.05], 22, 0, 0),
  S('materials', 0.86, [0.42, 0.5, -0.5], [0.03, 0.32, -0.34], 23, 0, 0),
  S('materials', 1.0, [0.52, 1.08, 0.62], [0.04, 0.88, 0.4], 24, 0, 0),

  // ── 09 Lighting ────────────────────────────────────────────────────────
  S('lighting', 0.4, [1.35, 1.05, 2.15], [0, 0.72, 0.2], 27, 0),
  S('lighting', 0.75, [1.95, 1.1, 2.6], [0, 0.68, 0.06], 26, 0),
  S('lighting', 1.0, [2.45, 1.18, 3.0], [0, 0.66, 0.0], 25, 0),

  // ── 10 Cockpit ─────────────────────────────────────────────────────────
  // Over the bars, then down into the rider's eye line.
  S('cockpit', 0.32, [1.45, 1.62, 2.3], [0, 0.9, 0.28], 25, 0, 0.5),
  S('cockpit', 0.6, [0.62, 1.52, 1.3], [0, 0.98, 0.26], 26, 0, 0.5),
  S('cockpit', 0.82, [0.2, 1.36, 0.56], [0, 1.03, 0.32], 27, 0, 0.5),
  S('cockpit', 1.0, [0.12, 1.34, 0.06], [0, 1.04, 0.9], 28, 0, 0.5),

  // ── 11 Ride ────────────────────────────────────────────────────────────
  // Low chase: the machine is moving and the camera is running with it.
  S('ride', 0.28, [1.0, 0.9, -2.0], [0, 0.62, 0.7], 32, 0, 0.5),
  S('ride', 0.62, [1.5, 1.1, -3.0], [0, 0.62, 0.6], 31, 0, 0.5),
  S('ride', 1.0, [2.1, 1.3, -3.85], [0, 0.62, 0.5], 30, 0, 0.5),

  // ── 12 Finale ──────────────────────────────────────────────────────────
  // The studio hero: three-quarter front, long lens, everything at rest.
  S('finale', 0.26, [3.2, 1.16, 2.4], [0, 0.62, 0.1], 32, 0),
  S('finale', 0.62, [3.95, 1.5, 4.1], [0, 0.6, 0.02], 30, 0),
  S('finale', 1.0, [4.5, 1.46, 4.7], [0, 0.6, 0], 29, 0),
]

/** Flattened control points, in the order the spline should be traced. */
const P = SHOTS.map((s) => new THREE.Vector3(s.p[0], s.p[1], s.p[2]))
const T = SHOTS.map((s) => new THREE.Vector3(s.target[0], s.target[1], s.target[2]))

const posCurve = new THREE.CatmullRomCurve3(P, false, 'catmullrom', 0.4)
const aimCurve = new THREE.CatmullRomCurve3(T, false, 'catmullrom', 0.4)

/**
 * Arc-length parameterisation.
 *
 * A Catmull-Rom spline is not uniform in speed: identical parameter steps can
 * cover wildly different distances, which would make the camera lurch between
 * close-ups. Re-parameterising by arc length gives the camera one constant
 * travel speed through the whole shot list, and the easing comes from the
 * progress mapping instead.
 */
const ARC_SAMPLES = 900
const arc: number[] = (() => {
  const out: number[] = [0]
  const probe = new THREE.Vector3()
  const prev = new THREE.Vector3()
  posCurve.getPoint(0, prev)
  let total = 0
  for (let i = 1; i <= ARC_SAMPLES; i++) {
    posCurve.getPoint(i / ARC_SAMPLES, probe)
    total += probe.distanceTo(prev)
    out.push(total)
    prev.copy(probe)
  }
  for (let i = 0; i < out.length; i++) out[i] /= total || 1
  return out
})()

function uFromArc(target: number): number {
  let lo = 0
  let hi = ARC_SAMPLES
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (arc[mid] < target) lo = mid + 1
    else hi = mid
  }
  if (lo === 0) return 0
  const a = arc[lo - 1]
  const b = arc[lo]
  const f = b > a ? (target - a) / (b - a) : 0
  return (lo - 1 + f) / ARC_SAMPLES
}

/** Arc-length fraction at a shot boundary. */
const NODE_ARC = SHOTS.map((_, i) => {
  const u = i / (SHOTS.length - 1)
  const idx = Math.round(u * ARC_SAMPLES)
  return arc[Math.min(ARC_SAMPLES, Math.max(0, idx))]
})

/** Map scroll progress to a normalised 0..1 position along the shot spline. */
function curveParam(progress: number): number {
  const n = SHOTS.length
  if (progress <= SHOTS[0].t) return 0
  if (progress >= SHOTS[n - 1].t) return 1
  for (let i = 0; i < n - 1; i++) {
    const a = SHOTS[i].t
    const b = SHOTS[i + 1].t
    if (progress >= a && progress <= b) {
      const local = smootherstep(a, b, progress)
      return uFromArc(NODE_ARC[i] + (NODE_ARC[i + 1] - NODE_ARC[i]) * local)
    }
  }
  return 1
}

/** Focal length eases between shots so zooms feel like real glass. */
function fovAt(progress: number): number {
  const n = SHOTS.length
  if (progress <= SHOTS[0].t) return SHOTS[0].fov
  if (progress >= SHOTS[n - 1].t) return SHOTS[n - 1].fov
  for (let i = 0; i < n - 1; i++) {
    const a = SHOTS[i].t
    const b = SHOTS[i + 1].t
    if (progress >= a && progress <= b) {
      const local = smootherstep(a, b, progress)
      return SHOTS[i].fov + (SHOTS[i + 1].fov - SHOTS[i].fov) * local
    }
  }
  return SHOTS[n - 1].fov
}

function rollAt(progress: number): number {
  const n = SHOTS.length
  if (progress <= SHOTS[0].t) return 0
  if (progress >= SHOTS[n - 1].t) return 0
  for (let i = 0; i < n - 1; i++) {
    const a = SHOTS[i].t
    const b = SHOTS[i + 1].t
    if (progress >= a && progress <= b) {
      const local = smootherstep(a, b, progress)
      return (
        ((SHOTS[i].roll ?? 0) +
          ((SHOTS[i + 1].roll ?? 0) - (SHOTS[i].roll ?? 0)) * local) *
        THREE.MathUtils.DEG2RAD
      )
    }
  }
  return 0
}

/**
 * Keep the lens out of the machine.
 *
 * The bike occupies a box around the origin; if a shot would put the camera
 * inside it, the position is pushed out along the shortest exit vector. This
 * is what lets the ride chapter fly a camera through the workspace without
 * clipping through bodywork.
 */
const NO_GO = new THREE.Box3(new THREE.Vector3(-0.62, 0.0, -1.0), new THREE.Vector3(0.62, 1.35, 1.05))
const NO_GO_CENTER = NO_GO.getCenter(new THREE.Vector3())

function pushOut(p: THREE.Vector3, clearance: number) {
  if (!NO_GO.containsPoint(p)) return
  const best = new THREE.Vector3()
  let bestDist = Infinity
  const faces: [THREE.Vector3, number][] = [
    [new THREE.Vector3(1, 0, 0), NO_GO.max.x - p.x],
    [new THREE.Vector3(-1, 0, 0), p.x - NO_GO.min.x],
    [new THREE.Vector3(0, 1, 0), NO_GO.max.y - p.y],
    [new THREE.Vector3(0, -1, 0), p.y - NO_GO.min.y],
    [new THREE.Vector3(0, 0, 1), NO_GO.max.z - p.z],
    [new THREE.Vector3(0, 0, -1), p.z - NO_GO.min.z],
  ]
  const radial = new THREE.Vector3(p.x - NO_GO_CENTER.x, 0, p.z - NO_GO_CENTER.z)
  if (radial.lengthSq() > 1e-6) {
    radial.normalize()
    const distToEdge =
      Math.abs(radial.x) > 1e-6
        ? (radial.x > 0 ? NO_GO.max.x - p.x : p.x - NO_GO.min.x) / Math.abs(radial.x)
        : Infinity
    faces.push([radial, Math.min(distToEdge, NO_GO.max.y - p.y + 0.6)])
  }
  for (const [dir, dist] of faces) {
    const d2 = dir.clone().multiplyScalar(dist + clearance)
    if (d2.lengthSq() < bestDist) {
      bestDist = d2.lengthSq()
      best.copy(d2)
    }
  }
  p.add(best)
}

export type CameraState = {
  position: THREE.Vector3
  target: THREE.Vector3
  fov: number
  roll: number
}

const _pos = new THREE.Vector3()
const _aim = new THREE.Vector3()

/**
 * Evaluate the shot list at a given timeline value.
 * Writes into the supplied state object so this is allocation-free per frame.
 *
 * `aspect` lets the framing adapt to the shape of the window: the authored
 * shot list is framed for a 16:9 cinema window, and portrait screens pull the
 * camera back and open the lens so a 2.1 m machine still fits.
 */
export function evaluateCamera(progress: number, out: CameraState, aspect = 16 / 9): void {
  const u = curveParam(progress)
  posCurve.getPointAt(u, _pos)
  aimCurve.getPointAt(u, _aim)
  pushOut(_pos, 0.16)

  const widen = adaptDistance(aspect)
  if (widen !== 1) _pos.sub(_aim).multiplyScalar(widen).add(_aim)

  out.fov = adaptFov(fovAt(progress), aspect)

  out.position.copy(_pos)
  out.target.copy(_aim)
  out.roll = rollAt(progress)
}

export function createCameraState(): CameraState {
  return {
    position: new THREE.Vector3(5.4, 2.6, 6.0),
    target: new THREE.Vector3(0, 0.6, 0),
    fov: 24,
    roll: 0,
  }
}
