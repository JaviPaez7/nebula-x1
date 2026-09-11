import { useMemo, useRef, type JSX, type ReactNode } from 'react'
import * as THREE from 'three'
import { withRevealOffset } from '../geometry'
import type { BikeMaterials } from '../bikeMaterials'

/* --------------------------------------------------------------- internals */

type Vec3 = [number, number, number]

export type S = {
  /** reveal sweep offset for this part, in metres of z-lead */
  r: number
  /** base translation */
  p?: Vec3
  /** base rotation, degrees, applied XYZ */
  rot?: Vec3
  /** uniform scale */
  sc?: number
}

export type M = { mat: THREE.Material; children?: ReactNode; cast?: boolean; receive?: boolean }

/** Geometry wrapper that stamps the part's reveal offset onto the geometry. */
export function P({ g, r, children }: { g: THREE.BufferGeometry; r: number; children?: ReactNode }) {
  const geo = useMemo(() => withRevealOffset(g, r), [g, r])
  return (
    <primitive object={geo} attach="geometry">
      {children}
    </primitive>
  )
}

/** Mesh with the standard shadow flags for this build. */
export function Body({
  g,
  r,
  mat,
  p,
  rot,
  sc,
  cast = true,
  receive = true,
  children,
}: {
  g: THREE.BufferGeometry
  /** reveal offset; omit when the geometry was already stamped by reliefOf() */
  r?: number
  mat: THREE.Material
  p?: Vec3
  rot?: Vec3
  sc?: number | Vec3
  cast?: boolean
  receive?: boolean
  children?: ReactNode
}): JSX.Element {
  const scale: Vec3 | undefined =
    sc === undefined ? undefined : typeof sc === 'number' ? [sc, sc, sc] : sc
  return (
    <mesh
      position={p}
      rotation={rot ? [THREE.MathUtils.degToRad(rot[0]), THREE.MathUtils.degToRad(rot[1]), THREE.MathUtils.degToRad(rot[2])] : undefined}
      scale={scale}
      castShadow={cast}
      receiveShadow={receive}
      material={mat}
    >
      {r === undefined ? <primitive object={g} attach="geometry" /> : <P g={g} r={r} />}
      {children}
    </mesh>
  )
}

/** Bolt ring helper — six hex heads arranged on a circle. */
export function BoltRing({
  count,
  radius,
  bolt,
  mat,
  r,
  p,
  rot,
  axis = 'x',
}: {
  count: number
  radius: number
  bolt: THREE.BufferGeometry
  mat: THREE.Material
  r: number
  p: Vec3
  rot?: Vec3
  axis?: 'x' | 'y' | 'z'
}) {
  return (
    <group position={p} rotation={rot ? [THREE.MathUtils.degToRad(rot[0]), THREE.MathUtils.degToRad(rot[1]), THREE.MathUtils.degToRad(rot[2])] : undefined}>
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2
        const pos: Vec3 =
          axis === 'x'
            ? [0, Math.cos(a) * radius, Math.sin(a) * radius]
            : axis === 'y'
              ? [Math.cos(a) * radius, 0, Math.sin(a) * radius]
              : [Math.cos(a) * radius, Math.sin(a) * radius, 0]
        return (
          <Body
            key={i}
            g={bolt}
            r={r}
            mat={mat}
            p={pos}
            rot={axis === 'x' ? [0, 0, 90] : axis === 'y' ? [0, 0, 0] : [90, 0, 0]}
            cast={false}
            receive={false}
          />
        )
      })}
    </group>
  )
}

/** Axial spine markers down the centre of a part — reads as engineered. */
export function Ribs({
  count,
  g,
  mat,
  r,
  from,
  to,
  sc = 1,
}: {
  count: number
  g: THREE.BufferGeometry
  mat: THREE.Material
  r: number
  from: Vec3
  to: Vec3
  sc?: number | Vec3
}) {
  return (
    <group>
      {Array.from({ length: count }, (_, i) => {
        const t = count === 1 ? 0.5 : i / (count - 1)
        return (
          <Body
            key={i}
            g={g}
            r={r}
            mat={mat}
            sc={sc}
            p={[from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, from[2] + (to[2] - from[2]) * t]}
          />
        )
      })}
    </group>
  )
}

/** Ref helper re-exported so part modules stay tidy. */
export function usePartRef() {
  return useRef<THREE.Group>(null)
}

export type PartProps = { mats: BikeMaterials }
