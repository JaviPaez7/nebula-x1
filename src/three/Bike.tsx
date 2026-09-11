import { useCallback, useEffect, useMemo, type JSX } from 'react'
import * as THREE from 'three'
import { createBikeMaterials, disposeBikeMaterials, type BikeMaterials } from './bikeMaterials'
import { buildTextureLibrary } from './textures'
import { PART_COUNT, PART_INDEX, type PartId } from './bikeParts'
import { FrontAssembly, Cockpit, Headlight, Tail, Swingarm } from './bike/front'
import { Battery, Motor, Chassis, Bodywork, BeltDrive } from './bike/core'
import { Wheel } from './bike/Wheel'

/** Render budget knobs, driven by the device tier. */
export type Quality = {
  tier: 'high' | 'medium' | 'low'
  shadows: boolean
  particleScale: number
  pixelRatio: number
}

/**
 * Mutable handles into the rig.
 *
 * The director writes transforms straight onto these objects every frame, so
 * no part of the bike is ever animated through React state — the mountain of
 * per-frame work lives entirely outside the component tree.
 */
export type RigRefs = {
  model: THREE.Group
  groups: (THREE.Group | null)[]
  frontWheel: THREE.Group | null
  rearWheel: THREE.Group | null
  batteryCase: THREE.Group | null
  batteryCore: THREE.Group | null
  batteryMesh: THREE.Group | null
  motorCase: THREE.Group | null
  motorRotor: THREE.Group | null
  headLED: THREE.Group | null
  tailLED: THREE.Group | null
}

export function createRigRefs(): RigRefs {
  return {
    model: new THREE.Group(),
    groups: new Array(PART_COUNT).fill(null),
    frontWheel: null,
    rearWheel: null,
    batteryCase: null,
    batteryCore: null,
    batteryMesh: null,
    motorCase: null,
    motorRotor: null,
    headLED: null,
    tailLED: null,
  }
}

function Part({
  id,
  refs,
  children,
}: {
  id: PartId
  refs: RigRefs
  children: React.ReactNode
}) {
  return (
    <group
      ref={(o) => {
        refs.groups[PART_INDEX[id]] = o
      }}
    >
      {children}
    </group>
  )
}

/**
 * The complete machine: eleven part groups, each holding real sub-assemblies.
 * Nothing here animates itself — the director owns every transform.
 */
export function BikeModel({
  refs,
  quality,
  onMaterials,
}: {
  refs: RigRefs
  quality: Quality
  onMaterials?: (m: BikeMaterials) => void
}): JSX.Element {
  const tex = useMemo(() => buildTextureLibrary(), [])
  const mats = useMemo(() => createBikeMaterials(tex), [tex])
  useEffect(() => () => disposeBikeMaterials(mats), [mats])
  useEffect(() => {
    onMaterials?.(mats)
  }, [mats, onMaterials])

  const tireSegments = quality.tier === 'high' ? 1 : quality.tier === 'medium' ? 0.76 : 0.56

  const setFrontSpin = useCallback((o: THREE.Group | null) => void (refs.frontWheel = o), [refs])
  const setRearSpin = useCallback((o: THREE.Group | null) => void (refs.rearWheel = o), [refs])

  return (
    <primitive object={refs.model} dispose={null}>
      <Part id="frontWheel" refs={refs}>
        <Wheel
          mats={mats}
          quality={tireSegments}
          spec={{ radius: 0.36, width: 0.125, rimR: 0.256, blades: 5 }}
          s={{ r: 0, p: [0, 0.335, 0.7] }}
          spinRef={setFrontSpin}
        />
      </Part>

      <Part id="fork" refs={refs}>
        <FrontAssembly mats={mats} />
      </Part>

      <Part id="headlight" refs={refs}>
        <Headlight mats={mats} ledRef={(o) => void (refs.headLED = o)} />
      </Part>

      <Part id="cockpit" refs={refs}>
        <Cockpit mats={mats} />
      </Part>

      <Part id="bodywork" refs={refs}>
        <Bodywork mats={mats} />
      </Part>

      <Part id="chassis" refs={refs}>
        <Chassis mats={mats} />
      </Part>

      <Part id="battery" refs={refs}>
        <Battery
          mats={mats}
          refs={{
            caseRef: (o) => void (refs.batteryCase = o),
            coreRef: (o) => void (refs.batteryCore = o),
            meshRef: (o) => void (refs.batteryMesh = o),
          }}
        />
      </Part>

      <Part id="motor" refs={refs}>
        <Motor
          mats={mats}
          refs={{
            caseRef: (o) => void (refs.motorCase = o),
            rotorRef: (o) => void (refs.motorRotor = o),
          }}
        />
      </Part>

      <Part id="swingarm" refs={refs}>
        <Swingarm mats={mats} />
        <BeltDrive mats={mats} />
      </Part>

      <Part id="rearWheel" refs={refs}>
        <Wheel
          mats={mats}
          quality={tireSegments}
          spec={{ radius: 0.345, width: 0.2, rimR: 0.24, blades: 5, discRadius: 0.2 }}
          s={{ r: 0, p: [0, 0.33, -0.68] }}
          spinRef={setRearSpin}
        />
      </Part>

      <Part id="seat" refs={refs}>
        <Tail mats={mats} ledRef={(o) => void (refs.tailLED = o)} />
      </Part>
    </primitive>
  )
}
