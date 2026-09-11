import * as THREE from 'three'

/**
 * Geometry helpers.
 *
 * Every solid on the bike is built from a small set of authoring primitives so
 * the silhouette stays coherent: chamfered extrusions for bodywork, lofted
 * profiles for the frame, and lathed hardware for the mechanicals.
 */

/* ------------------------------------------------------------- chamfered */

/**
 * Takes an extruded shape and bevels its edges by pushing boundary vertices
 * inward along the local normal. Cheaper than CSG and reads exactly like a
 * CNC-machined or compression-moulded part under a raking light.
 */
export function crease(geo: THREE.BufferGeometry, amount = 0.006): THREE.BufferGeometry {
  const pos = geo.attributes.position as THREE.BufferAttribute
  const nor = geo.attributes.normal as THREE.BufferAttribute
  if (!pos || !nor) return geo
  const v = new THREE.Vector3()
  const n = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    n.fromBufferAttribute(nor, i)
    // Only soften the sharp outer shell, leave flat faces untouched.
    if (Math.abs(n.x) + Math.abs(n.y) + Math.abs(n.z) < 1.9) {
      v.addScaledVector(n, -amount)
      pos.setXYZ(i, v.x, v.y, v.z)
    }
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}

/** Extrude a 2D profile with a small bevel — the workhorse for bodywork. */
export function extruded(
  points: [number, number][],
  depth: number,
  opts: { bevel?: number; curveSegments?: number } = {},
) {
  const shape = new THREE.Shape()
  shape.moveTo(points[0][0], points[0][1])
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1])
  shape.closePath()
  const bevel = opts.bevel ?? 0.006
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: opts.curveSegments ?? 6,
  })
  geo.translate(0, 0, -depth / 2)
  geo.computeVertexNormals()
  geo.computeBoundingBox()
  return geo
}

/** A smooth closed profile through control points, sampled as a polyline. */
export function smoothProfile(points: [number, number][], perSegment = 5): [number, number][] {
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(p[0], p[1], 0)),
    false,
    'catmullrom',
    0.5,
  )
  const out: [number, number][] = []
  const n = points.length * perSegment
  for (let i = 0; i <= n; i++) {
    const p = curve.getPoint(i / n)
    out.push([p.x, p.y])
  }
  return out
}

/* ----------------------------------------------------------------- wheel */

export type WheelGeometry = {
  tire: THREE.BufferGeometry
  rim: THREE.BufferGeometry
  spoke: THREE.BufferGeometry
  spokeCount: number
  spokePhase: number
  hub: THREE.BufferGeometry
  disc: THREE.BufferGeometry
  discInner: THREE.BufferGeometry
  radius: number
  width: number
  base: number
}

/**
 * A real motorcycle wheel: torus tyre, deep-section rim barrel, five split
 * "Y" spokes and a pair of floating brake discs.
 */
export function buildWheel(radius: number, width: number, spokeCount = 5): WheelGeometry {
  const tube = width * 0.44
  const tire = new THREE.TorusGeometry(radius - tube, tube, 20, 72)
  tire.rotateY(Math.PI / 2)
  // Squash the torus into a proper tyre cross-section and flatten the crown.
  const tp = tire.attributes.position as THREE.BufferAttribute
  const v = new THREE.Vector3()
  for (let i = 0; i < tp.count; i++) {
    v.fromBufferAttribute(tp, i)
    const r = Math.hypot(v.y, v.z)
    if (r > 1e-5) {
      const scale = 1 + 0.07 * (1 - r / radius)
      v.y *= 1 - (1 - scale) * 0.4
      v.z *= 1 - (1 - scale) * 0.4
    }
    // slight crown flattening at the contact patch
    v.x *= 0.98 + 0.02 * Math.cos((Math.atan2(v.z, v.y) || 0) * 2)
    tp.setXYZ(i, v.x, v.y, v.z)
  }
  tp.needsUpdate = true
  tire.computeVertexNormals()

  const rimR = radius - tube * 1.95
  const rim = new THREE.CylinderGeometry(rimR, rimR, width * 0.72, 44, 1, true)
  rim.rotateZ(Math.PI / 2)

  const bladeW = width * 0.17
  const spoke = new THREE.BoxGeometry(bladeW, rimR * 0.52, radius * 0.055)
  spoke.translate(0, rimR * 0.28, 0)

  const hub = new THREE.CylinderGeometry(radius * 0.13, radius * 0.13, width * 0.86, 22)
  hub.rotateZ(Math.PI / 2)

  const discR = radius * 0.62
  const disc = new THREE.CylinderGeometry(discR, discR, 0.0055, 56)
  disc.rotateZ(Math.PI / 2)
  const discInner = new THREE.CylinderGeometry(discR * 0.6, discR * 0.6, 0.0075, 40)
  discInner.rotateZ(Math.PI / 2)

  return {
    tire,
    rim,
    spoke,
    spokeCount,
    spokePhase: 0,
    hub,
    disc,
    discInner,
    radius,
    width,
    base: width * 0.5 + 0.006,
  }
}


/* ------------------------------------------------------------- hardware */

/** Bolt head — used liberally; instanced by the caller where it matters. */
export function boltGeometry(r = 0.012, h = 0.01) {
  const g = new THREE.CylinderGeometry(r, r * 0.94, h, 6)
  return g
}

/** A stack of cooling fins for the drive unit housing. */
export function finStack(count: number, r: number, gap: number) {
  const geos: THREE.BufferGeometry[] = []
  for (let i = 0; i < count; i++) {
    const g = new THREE.TorusGeometry(r, gap * 0.22, 5, 28)
    g.rotateY(Math.PI / 2)
    g.translate(0, 0, (i - (count - 1) / 2) * gap)
    geos.push(g)
  }
  return mergeGeometries(geos)
}

/** Minimal geometry merge so we can ship a cluster of same-material solids as one draw call. */
export function mergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let vTotal = 0
  let iTotal = 0
  for (const g of geos) {
    vTotal += g.attributes.position.count
    iTotal += g.index ? g.index.count : g.attributes.position.count
  }
  const pos = new Float32Array(vTotal * 3)
  const nor = new Float32Array(vTotal * 3)
  const uv = new Float32Array(vTotal * 2)
  const idx = new Uint32Array(iTotal)
  let vo = 0
  let io = 0
  for (const g of geos) {
    const gp = g.attributes.position as THREE.BufferAttribute
    const gn = g.attributes.normal as THREE.BufferAttribute
    const gu = g.attributes.uv as THREE.BufferAttribute | undefined
    for (let i = 0; i < gp.count; i++) {
      pos[(vo + i) * 3] = gp.getX(i)
      pos[(vo + i) * 3 + 1] = gp.getY(i)
      pos[(vo + i) * 3 + 2] = gp.getZ(i)
      if (gn) {
        nor[(vo + i) * 3] = gn.getX(i)
        nor[(vo + i) * 3 + 1] = gn.getY(i)
        nor[(vo + i) * 3 + 2] = gn.getZ(i)
      }
      if (gu) {
        uv[(vo + i) * 2] = gu.getX(i)
        uv[(vo + i) * 2 + 1] = gu.getY(i)
      }
    }
    const gi = g.index
    if (gi) {
      for (let i = 0; i < gi.count; i++) idx[io + i] = gi.getX(i) + vo
      io += gi.count
    } else {
      for (let i = 0; i < gp.count; i++) idx[io + i] = i + vo
      io += gp.count
    }
    vo += gp.count
  }
  const merged = new THREE.BufferGeometry()
  merged.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  merged.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  merged.setIndex(new THREE.BufferAttribute(idx, 1))
  merged.computeBoundingSphere()
  return merged
}

/**
 * Attach the per-part reveal offset attribute. The sweep shader reads it so a
 * single shared material can still reveal each component at its own moment.
 */
export function withRevealOffset<T extends THREE.BufferGeometry>(geo: T, offset: number): T {
  const count = geo.attributes.position.count
  const arr = new Float32Array(count)
  arr.fill(offset)
  geo.setAttribute('aRevealOffset', new THREE.BufferAttribute(arr, 1))
  return geo
}
