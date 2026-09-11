import { useCallback, useEffect, useMemo, type JSX } from 'react'
import * as THREE from 'three'
import type { BikeMaterials } from '../bikeMaterials'
import { mergeGeometries, withRevealOffset } from '../geometry'
import { buildDiscBobbins, buildDiscPair, buildYSpokeWheel } from './spokes'
import { Body, type S } from './common'

export type WheelSpec = {
  /** outer tyre radius, metres */
  radius: number
  /** tyre width (section), metres */
  width: number
  /** rim radius, metres */
  rimR: number
  blades?: number
  discRadius?: number
  /** spin axis alignment: front wheels and rear wheels both spin about X */
  spinSign?: number
  /** no brake discs (used for the standalone exploded wheel) */
  bare?: boolean
}

/**
 * A complete wheel: tyre, deep-section rim, forged Y-spokes, hub, brake discs
 * with bobbins, a caliper and the ABS tone ring.
 */
export function Wheel({
  spec,
  mats,
  s,
  quality = 1,
  spinRef,
}: {
  spec: WheelSpec
  mats: BikeMaterials
  s: S
  quality?: number
  spinRef?: (o: THREE.Group | null) => void
}): JSX.Element {
  const tireSeg = Math.round(76 * quality)
  const onSpin = useCallback((o: THREE.Group | null) => spinRef?.(o), [spinRef])

  const geo = useMemo(() => {
    const { radius, width, rimR } = spec
    const tube = (radius - rimR) * 0.5
    const centerR = rimR + tube

    // ---- tyre: a torus squashed into a proper motorcycle cross-section
    const tire = new THREE.TorusGeometry(centerR, tube, 16, tireSeg)
    tire.rotateY(Math.PI / 2)
    const tp = tire.attributes.position as THREE.BufferAttribute
    const v = new THREE.Vector3()
    for (let i = 0; i < tp.count; i++) {
      v.fromBufferAttribute(tp, i)
      const section = Math.hypot(v.x, Math.hypot(v.y, v.z) - centerR)
      if (section > 1e-6) {
        const ang = Math.atan2(v.x, Math.hypot(v.y, v.z) - centerR)
        v.x = Math.cos(ang) * (width * 0.5)
        const rr = Math.hypot(v.y, v.z)
        const newR = centerR + Math.sin(ang) * tube
        if (rr > 1e-6) {
          v.y = (v.y / rr) * newR
          v.z = (v.z / rr) * newR
        }
      }
      tp.setXYZ(i, v.x, v.y, v.z)
    }
    tp.needsUpdate = true
    tire.computeVertexNormals()

    // ---- rim barrel with a lip at the outside
    const rim = new THREE.CylinderGeometry(rimR, rimR, width * 0.7, 48, 1, true)
    rim.rotateZ(Math.PI / 2)
    const lipA = new THREE.TorusGeometry(rimR, 0.009, 6, 48)
    lipA.rotateY(Math.PI / 2)
    lipA.translate(width * 0.35, 0, 0)
    const lipB = lipA.clone()
    lipB.translate(-width * 0.7, 0, 0)
    const rimAll = mergeGeometries([rim, lipA, lipB])

    // ---- forged spokes
    const spokes = buildYSpokeWheel(rimR * 0.995, width * 0.9, spec.blades ?? 5)

    // ---- hub + axle
    const hub = new THREE.CylinderGeometry(rimR * 0.24, rimR * 0.24, width * 0.9, 24)
    hub.rotateZ(Math.PI / 2)
    const axle = new THREE.CylinderGeometry(0.019, 0.019, width + 0.14, 14)
    axle.rotateZ(Math.PI / 2)
    const hubAll = mergeGeometries([hub, axle])

    // ---- brake hardware
    const discR = spec.discRadius ?? rimR * 0.72
    const discs = spec.bare ? null : buildDiscPair(discR, width * 0.42)
    const bobbins = spec.bare ? null : buildDiscBobbins(discR, width * 0.44, 10)

    // ---- ABS tone ring
    const abs = spec.bare
      ? null
      : (() => {
          const g = new THREE.TorusGeometry(discR * 0.52, 0.005, 4, 32)
          g.rotateY(Math.PI / 2)
          g.translate(0, 0, -width * 0.46)
          return g
        })()

    return { tire, rimAll, spokes, hubAll, discs, bobbins, abs }
  }, [spec.radius, spec.width, spec.rimR, spec.blades, spec.discRadius, spec.bare, tireSeg])

  useEffect(
    () => () => {
      geo.tire.dispose()
      geo.rimAll.dispose()
      geo.spokes.dispose()
      geo.hubAll.dispose()
      geo.discs?.dispose()
      geo.bobbins?.dispose()
      geo.abs?.dispose()
    },
    [geo],
  )

  return (
    <group position={s.p} rotation={s.rot ? [THREE.MathUtils.degToRad(s.rot[0]), THREE.MathUtils.degToRad(s.rot[1]), THREE.MathUtils.degToRad(s.rot[2])] : undefined} scale={s.sc}>
      <group ref={onSpin} name="wheel-spin">
        <Body g={withRevealOffset(geo.tire, s.r)} mat={mats.rubber} cast receive={false} />
        <Body g={withRevealOffset(geo.rimAll, s.r + 0.004)} mat={mats.aluminium} />
        <Body g={withRevealOffset(geo.spokes, s.r + 0.008)} mat={mats.aluminiumDark} />
        <Body g={withRevealOffset(geo.hubAll, s.r)} mat={mats.anodised} />
        {geo.discs && <Body g={withRevealOffset(geo.discs, s.r - 0.004)} mat={mats.brakeDisc} />}
        {geo.bobbins && <Body g={withRevealOffset(geo.bobbins, s.r - 0.004)} mat={mats.anodised} cast={false} />}
        {geo.abs && <Body g={withRevealOffset(geo.abs, s.r - 0.004)} mat={mats.titanium} cast={false} />}
      </group>
    </group>
  )
}

/**
 * Radial brake caliper: a machined monobloc body with four piston bosses,
 * clamped over the disc. Only the visible outboard side is modelled.
 */
export function Caliper({
  mats,
  s,
  radius,
  thickness = 0.05,
  side = 1,
  x = 0,
}: {
  mats: BikeMaterials
  s: { r: number }
  radius: number
  thickness?: number
  side?: number
  x?: number
}) {
  const geo = useMemo(() => {
    const body = new THREE.BoxGeometry(thickness, radius * 0.62, radius * 0.42)
    const bridge = new THREE.BoxGeometry(thickness * 0.5, radius * 0.34, radius * 0.5)
    bridge.translate(0, 0, 0)
    const pistonA = new THREE.CylinderGeometry(radius * 0.09, radius * 0.09, thickness * 1.04, 10)
    pistonA.rotateZ(Math.PI / 2)
    pistonA.translate(0, radius * 0.17, 0)
    const pistonB = pistonA.clone()
    pistonB.translate(0, -radius * 0.34, 0)
    const mountA = new THREE.BoxGeometry(thickness * 0.5, radius * 0.2, radius * 0.1)
    mountA.translate(0, radius * 0.4, -radius * 0.16)
    const mountB = mountA.clone()
    mountB.translate(0, -radius * 0.8, 0)
    return mergeGeometries([body, bridge, pistonA, pistonB, mountA, mountB])
  }, [radius, thickness])

  useEffect(() => () => geo.dispose(), [geo])

  return (
    <Body
      g={withRevealOffset(geo, s.r)}
      mat={mats.aluminium}
      p={[x, 0, 0]}
      rot={[0, 0, 0]}
      sc={[1, 1, side]}
    />
  )
}
