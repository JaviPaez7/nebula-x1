import * as THREE from 'three'
import { mergeGeometries } from '../geometry'

export type SpokeSeg = {
  /** radius at the start of the segment */
  r0: number
  /** radius at the end of the segment */
  r1: number
  /** start angle, radians */
  a0: number
  /** end angle, radians */
  a1: number
  /** half-width across the spoke, metres */
  w0: number
  w1: number
  /** half-thickness, metres */
  t0: number
  t1: number
}

/**
 * Build a tapered solid that follows the wheel plane (z = 0) between two
 * polar coordinates. The cross-section is a rounded rectangle whose width
 * tapers along the spoke and whose thickness follows the wheel's dish.
 *
 * The result is a proper forged-aluminium spoke: an I-beam-ish blade that
 * starts deep at the hub and necks down where it meets the rim.
 */
function spokeSeg(seg: SpokeSeg, twist = 0): THREE.BufferGeometry {
  const steps = 7
  const ring = 8 // vertices per cross-section
  const positions = new Float32Array((steps + 1) * ring * 3)
  const indices: number[] = []

  const pt = (t: number, w: number, th: number, sign: number) => {
    const r = seg.r0 + (seg.r1 - seg.r0) * t
    const a = seg.a0 + (seg.a1 - seg.a0) * t + twist * t
    // local frame: radial direction and a lateral direction inside the plane
    const ur = { y: Math.cos(a), z: Math.sin(a) }
    const ul = { y: -Math.sin(a), z: Math.cos(a) }
    // cross-section: rounded rect in (lateral, axial) with a chamfered profile
    const table: [number, number][] = [
      [-1, 0.42],
      [-0.72, 0.92],
      [0, 1],
      [0.72, 0.92],
      [1, 0.42],
      [0.72, -0.92],
      [0, -1],
      [-0.72, -0.92],
    ]
    return table.map(([l, x]) => ({
      y: ur.y * r + ul.y * (l * w),
      z: ur.z * r + ul.z * (l * w),
      x: x * th * sign,
    }))
  }

  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const w = seg.w0 + (seg.w1 - seg.w0) * t
    const th = seg.t0 + (seg.t1 - seg.t0) * t
    const ringPts = pt(t, w, th, 1)
    for (let j = 0; j < ring; j++) {
      const o = (i * ring + j) * 3
      positions[o] = ringPts[j].x
      positions[o + 1] = ringPts[j].y
      positions[o + 2] = ringPts[j].z
    }
  }
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < ring; j++) {
      const a = i * ring + j
      const b = i * ring + ((j + 1) % ring)
      const c = (i + 1) * ring + ((j + 1) % ring)
      const d = (i + 1) * ring + j
      indices.push(a, b, c, a, c, d)
    }
  }
  // caps
  const capStart = 0
  const capEnd = steps * ring
  for (let j = 1; j < ring - 1; j++) {
    indices.push(capStart, capStart + j + 1, capStart + j)
    indices.push(capEnd, capEnd + j, capEnd + j + 1)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((steps + 1) * ring * 2), 2))
  return geo
}

/**
 * Five-blade Y forging: a radial blade from the hub that splits into two
 * limbs meeting the rim between the next blade's root.
 */
export function buildYSpokeWheel(
  rimR: number,
  width: number,
  blades = 5,
  opts: { slim?: boolean } = {},
): THREE.BufferGeometry {
  const hubR = rimR * 0.19
  const splitR = rimR * 0.5
  const step = (Math.PI * 2) / blades
  const thick = width * (opts.slim ? 0.22 : 0.3)
  const geos: THREE.BufferGeometry[] = []

  for (let k = 0; k < blades; k++) {
    const c = k * step
    // root blade: hub -> split point, dead radial
    geos.push(
      spokeSeg({
        r0: hubR,
        r1: splitR,
        a0: c,
        a1: c,
        w0: width * 0.17,
        w1: width * 0.14,
        t0: thick,
        t1: thick * 0.86,
      }),
    )
    // two limbs: split point -> rim, at +/- 43% of the step
    const out = step * 0.46
    geos.push(
      spokeSeg({
        r0: splitR,
        r1: rimR * 1.004,
        a0: c,
        a1: c + out,
        w0: width * 0.13,
        w1: width * 0.075,
        t0: thick * 0.84,
        t1: thick * 0.5,
      }),
    )
    geos.push(
      spokeSeg({
        r0: splitR,
        r1: rimR * 1.004,
        a0: c,
        a1: c - out,
        w0: width * 0.13,
        w1: width * 0.075,
        t0: thick * 0.84,
        t1: thick * 0.5,
      }),
    )
  }
  return mergeGeometries(geos)
}

/** A pair of brake discs with their inner carriers, offset either side of z=0. */
export function buildDiscPair(radius: number, offset: number): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = []
  for (const s of [-1, 1]) {
    const outer = new THREE.CylinderGeometry(radius, radius, 0.0055, 44, 1)
    outer.rotateZ(Math.PI / 2)
    outer.translate(0, 0, s * offset)
    const inner = new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, 0.008, 24)
    inner.rotateZ(Math.PI / 2)
    inner.translate(0, 0, s * offset)
    geos.push(outer, inner)
  }
  return mergeGeometries(geos)
}

/** Drilled-hole pattern is faked with a ring of small recessed cylinders. */
export function buildDiscBobbins(radius: number, offset: number, count = 10): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = []
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2
    for (const s of [-1, 1]) {
      const g = new THREE.CylinderGeometry(0.011, 0.011, 0.009, 6)
      g.rotateZ(Math.PI / 2)
      g.translate(0, Math.cos(a) * radius * 0.8, Math.sin(a) * radius * 0.8 + s * offset)
      geos.push(g)
    }
  }
  return mergeGeometries(geos)
}
