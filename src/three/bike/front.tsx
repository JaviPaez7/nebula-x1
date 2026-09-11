import { useEffect, useMemo, type JSX } from 'react'
import * as THREE from 'three'
import type { BikeMaterials } from '../bikeMaterials'
import { mergeGeometries, withRevealOffset } from '../geometry'
import { Body } from './common'
import { HARD, RAKE, reliefOf } from '../bikeParts'

/* --------------------------------------------------------------- helpers */

const RAKE_DEG = THREE.MathUtils.radToDeg(RAKE)

/** Local frame of the steering axis: origin at the front axle, +Y up the rake. */
export const FORK_FRAME = (() => {
  const origin = HARD.frontAxle.clone()
  const up = new THREE.Vector3(Math.sin(RAKE), Math.cos(RAKE), 0)
  const length = origin.y / Math.cos(RAKE)
  const top = origin.clone().addScaledVector(up, length)
  return { origin, up, length, top }
})()

/* ------------------------------------------------------ front assembly */

/**
 * 48 mm titanium-nitride fork with machined triple clamps, radial monobloc
 * calipers, a forged steering stem and a pair of tapered fork legs. Built in
 * the steering-axis local frame because that is how the part actually exists.
 */
export function FrontAssembly({ mats }: { mats: BikeMaterials }): JSX.Element {
  const r = reliefOf('fork')
  const geo = useMemo(() => {
    const legX = 0.108
    const upperR = 0.0265
    const lowerR = 0.0375
    const upperLen = 0.5
    const lowerLen = 0.2

    const tube = (radius: number, len: number, x: number, y: number) => {
      const g = new THREE.CylinderGeometry(radius, radius, len, 20)
      g.translate(x, y, 0)
      return g
    }
    const uppers = mergeGeometries([
      tube(upperR, upperLen, legX, 0.16 + upperLen / 2),
      tube(upperR, upperLen, -legX, 0.16 + upperLen / 2),
    ])
    const lowers = mergeGeometries([
      tube(lowerR, lowerLen, legX, -0.06),
      tube(lowerR, lowerLen, -legX, -0.06),
    ])

    // triple clamps: two yokes plus the stem and the bar mounts
    const yoke = (y: number, h: number, w: number) => {
      const g = new THREE.BoxGeometry(w, h, 0.088)
      g.translate(0, y, 0)
      return g
    }
    const clamps = mergeGeometries([
      yoke(0.51, 0.036, 0.34),
      yoke(0.63, 0.03, 0.3),
      (() => {
        const g = new THREE.CylinderGeometry(0.026, 0.026, 0.16, 14)
        g.translate(0, 0.57, 0)
        return g
      })(),
    ])

    // axial (radial-mount) brake calipers on both discs
    const caliper = (side: number) => {
      const body = new THREE.BoxGeometry(0.052, 0.15, 0.1)
      const bridge = new THREE.BoxGeometry(0.03, 0.08, 0.13)
      const a = new THREE.CylinderGeometry(0.019, 0.019, 0.056, 10)
      a.rotateZ(Math.PI / 2)
      a.translate(0, 0.042, 0)
      const b = a.clone()
      b.translate(0, -0.084, 0)
      const g = mergeGeometries([body, bridge, a, b])
      g.translate(side * 0.062, -0.16, -0.12)
      return g
    }
    const calipers = mergeGeometries([caliper(1), caliper(-1)])

    // front fender: a thin shell that follows the tyre
    const fender = (() => {
      const g = new THREE.CylinderGeometry(0.405, 0.405, 0.15, 26, 1, true, Math.PI * 0.08, Math.PI * 0.84)
      g.rotateZ(Math.PI / 2)
      g.scale(1, 1, 1)
      const pos = g.attributes.position as THREE.BufferAttribute
      const v = new THREE.Vector3()
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i)
        const rr = Math.hypot(v.y, v.z)
        const t = THREE.MathUtils.clamp(Math.abs(v.x) / 0.075, 0, 1)
        const shrink = 0.86 + 0.14 * (1 - t * t)
        v.y *= shrink
        v.z *= shrink
        void rr
        pos.setXYZ(i, v.x, v.y, v.z)
      }
      pos.needsUpdate = true
      g.computeVertexNormals()
      g.translate(0, -0.005, 0.055)
      return g
    })()

    const axle = new THREE.CylinderGeometry(0.021, 0.021, 0.2, 14)
    axle.rotateZ(Math.PI / 2)

    return { uppers, lowers, clamps, calipers, fender, axle }
  }, [])

  const stemY = FORK_FRAME.length
  useEffect(
    () => () => {
      for (const g of Object.values(geo)) if (g instanceof THREE.BufferGeometry) g.dispose()
    },
    [geo],
  )

  return (
    <group position={FORK_FRAME.origin} rotation={[0, 0, -RAKE_DEG]}>
      <Body g={withRevealOffset(geo.uppers, r + 0.02)} mat={mats.titanium} />
      <Body g={withRevealOffset(geo.lowers, r)} mat={mats.aluminiumDark} />
      <Body g={withRevealOffset(geo.clamps, r + 0.05)} mat={mats.aluminium} />
      <Body g={withRevealOffset(geo.calipers, r - 0.03)} mat={mats.aluminium} />
      <Body g={withRevealOffset(geo.fender, r - 0.02)} mat={mats.carbonPanel} />
      <Body g={withRevealOffset(geo.axle, r)} mat={mats.anodised} cast={false} />
      {/* steering stem nut, a small machined flourish at the top */}
      <Body
        g={withRevealOffset(new THREE.CylinderGeometry(0.026, 0.026, 0.022, 6), r + 0.05)}
        mat={mats.titanium}
        p={[0, stemY - 0.02, 0]}
        cast={false}
      />
    </group>
  )
}

/* -------------------------------------------------------------- cockpit */

/** Handlebar, grips, levers, mirrors and the instrument binnacle. */
export function Cockpit({ mats }: { mats: BikeMaterials }): JSX.Element {
  const r = reliefOf('cockpit')
  const geo = useMemo(() => {
    const bar = new THREE.CylinderGeometry(0.016, 0.016, 0.68, 14)
    bar.rotateZ(Math.PI / 2)
    const clampL = new THREE.CylinderGeometry(0.027, 0.027, 0.03, 12)
    clampL.translate(0.1, 0.01, 0)
    const clampR = clampL.clone()
    clampR.translate(-0.2, 0, 0)
    const barAll = mergeGeometries([bar, clampL, clampR])

    const grip = new THREE.CylinderGeometry(0.021, 0.022, 0.13, 14)
    grip.rotateZ(Math.PI / 2)
    grip.translate(0.255, 0.006, 0)
    const gripR = grip.clone()
    gripR.translate(-0.51, 0, 0)
    const grips = mergeGeometries([grip, gripR])

    const lever = (side: number) => {
      const g = new THREE.BoxGeometry(0.115, 0.01, 0.022)
      g.rotateZ(side * 0.16)
      g.translate(side * 0.19, -0.012, 0.055)
      return g
    }
    const levers = mergeGeometries([lever(1), lever(-1)])

    const mirror = (side: number) => {
      const stalk = new THREE.CylinderGeometry(0.008, 0.008, 0.17, 8)
      stalk.rotateZ(side * 0.42)
      stalk.translate(side * 0.145, 0.088, 0.01)
      const head = new THREE.BoxGeometry(0.09, 0.055, 0.016)
      head.rotateZ(side * 0.42)
      head.translate(side * 0.2, 0.168, 0.01)
      return mergeGeometries([stalk, head])
    }
    const mirrors = mergeGeometries([mirror(1), mirror(-1)])

    // instrument binnacle: a tilted, softly bonded panel
    const binnacle = new THREE.BoxGeometry(0.2, 0.012, 0.135)
    const shroud = new THREE.BoxGeometry(0.215, 0.05, 0.15)
    shroud.translate(0, -0.028, -0.005)
    const glass = new THREE.BoxGeometry(0.183, 0.006, 0.118)
    glass.translate(0, 0.012, 0)
    const binnacleAll = mergeGeometries([binnacle, shroud])

    return { barAll, grips, levers, mirrors, binnacle: binnacleAll, glass }
  }, [])

  useEffect(
    () => () => {
      for (const g of Object.values(geo)) if (g instanceof THREE.BufferGeometry) g.dispose()
    },
    [geo],
  )

  return (
    <group position={[0, 1.005, 0.24]} rotation={[THREE.MathUtils.degToRad(-17), 0, 0]}>
      <Body g={withRevealOffset(geo.barAll, r)} mat={mats.anodised} />
      <Body g={withRevealOffset(geo.grips, r)} mat={mats.rubberSoft} cast={false} />
      <Body g={withRevealOffset(geo.levers, r)} mat={mats.aluminium} cast={false} />
      <Body g={withRevealOffset(geo.mirrors, r)} mat={mats.structural} cast={false} />
      <group position={[0, 0.062, 0.12]} rotation={[THREE.MathUtils.degToRad(-8), 0, 0]}>
        <Body g={withRevealOffset(geo.binnacle, r + 0.02)} mat={mats.carbonMatte} />
        <Body g={withRevealOffset(geo.glass, r + 0.02)} mat={mats.lens} cast={false} receive={false} />
      </group>
    </group>
  )
}

/* ------------------------------------------------------------- lighting */

/**
 * Matrix LED headlight: a machined carrier ring, a vertical DRL blade and
 * three projector modules under a single polycarbonate lens.
 */
export function Headlight({ mats, ledRef }: { mats: BikeMaterials; ledRef?: (o: THREE.Group | null) => void }) {
  const r = reliefOf('headlight')
  const geo = useMemo(() => {
    const shell = new THREE.BoxGeometry(0.19, 0.2, 0.09)
    const rim = new THREE.TorusGeometry(0.086, 0.014, 8, 26)
    rim.rotateY(Math.PI / 2)
    rim.scale(1, 1.08, 0.86)
    rim.translate(0, 0, 0.038)
    const shellAll = mergeGeometries([shell, rim])

    const blade = new THREE.BoxGeometry(0.016, 0.145, 0.02)
    blade.translate(0, 0, 0.088)
    const brow = new THREE.BoxGeometry(0.15, 0.012, 0.016)
    brow.translate(0, 0.082, 0.08)

    const projector = new THREE.CylinderGeometry(0.032, 0.026, 0.05, 16)
    projector.rotateX(Math.PI / 2)
    const p1 = projector.clone()
    p1.translate(-0.046, -0.026, 0.075)
    const p2 = projector.clone()
    p2.translate(0.046, -0.026, 0.075)
    const p3 = projector.clone()
    p3.translate(0, -0.062, 0.07)
    const projectors = mergeGeometries([p1, p2, p3])

    const lens = new THREE.BoxGeometry(0.168, 0.176, 0.022)
    lens.translate(0, 0, 0.098)

    const screen = new THREE.BoxGeometry(0.155, 0.162, 0.006)
    screen.translate(0, 0, 0.111)

    // flyscreen: a slim blade above the lamp that gives the front its intent
    const screen2 = new THREE.BoxGeometry(0.2, 0.115, 0.014)
    screen2.rotateX(THREE.MathUtils.degToRad(-34))
    screen2.translate(0, 0.175, 0.055)

    return { shellAll, blade, brow, projectors, lens, screen, fly: screen2 }
  }, [])

  useEffect(
    () => () => {
      for (const g of Object.values(geo)) if (g instanceof THREE.BufferGeometry) g.dispose()
    },
    [geo],
  )

  return (
    <group position={[0, 1.045, 0.3]} rotation={[THREE.MathUtils.degToRad(-14), 0, 0]}>
      <Body g={withRevealOffset(geo.shellAll, r)} mat={mats.aluminiumDark} />
      <Body g={withRevealOffset(geo.fly, r + 0.03)} mat={mats.carbonPanel} />
      <Body g={withRevealOffset(geo.projectors, r + 0.02)} mat={mats.anodised} cast={false} />
      <Body g={withRevealOffset(geo.lens, r + 0.02)} mat={mats.lens} cast={false} receive={false} />
      <group ref={ledRef}>
        <Body g={withRevealOffset(geo.blade, r + 0.03)} mat={mats.headlightLED} cast={false} receive={false} />
        <Body g={withRevealOffset(geo.brow, r + 0.03)} mat={mats.headlightLED} cast={false} receive={false} />
        <Body g={withRevealOffset(geo.screen, r + 0.03)} mat={mats.accentLED} cast={false} receive={false} />
      </group>
    </group>
  )
}

/**
 * Tail: structural seat unit, LED strip, plate hanger and the rear light
 * signature that mirrors the front blade.
 */
export function Tail({ mats, ledRef }: { mats: BikeMaterials; ledRef?: (o: THREE.Group | null) => void }) {
  const r = reliefOf('seat')
  const geo = useMemo(() => {
    // subframe rails
    const rail = new THREE.BoxGeometry(0.026, 0.05, 0.62)
    rail.rotateX(THREE.MathUtils.degToRad(-9))
    const railL = rail.clone()
    railL.translate(0.084, 0.9, -0.4)
    const railR = rail.clone()
    railR.translate(-0.084, 0.9, -0.4)
    const cross = new THREE.BoxGeometry(0.16, 0.03, 0.04)
    cross.translate(0, 0.88, -0.63)
    const rails = mergeGeometries([railL, railR, cross])

    // seat pan + pad
    const pan = new THREE.BoxGeometry(0.2, 0.05, 0.42)
    pan.rotateX(THREE.MathUtils.degToRad(-3))
    pan.translate(0, 0.885, -0.16)
    const pad = new THREE.BoxGeometry(0.185, 0.055, 0.38)
    pad.rotateX(THREE.MathUtils.degToRad(-3))
    pad.translate(0, 0.925, -0.145)

    // tail cone: a tapered wedge that lifts away from the seat
    const cone = new THREE.BoxGeometry(0.17, 0.1, 0.34)
    cone.translate(0, 0.945, -0.44)
    const coneTop = new THREE.BoxGeometry(0.13, 0.05, 0.3)
    coneTop.translate(0, 0.995, -0.45)
    const tailLamp = new THREE.BoxGeometry(0.115, 0.028, 0.02)
    tailLamp.translate(0, 0.94, -0.612)
    const plateArm = new THREE.BoxGeometry(0.05, 0.17, 0.02)
    plateArm.rotateX(0.22)
    plateArm.translate(0, 0.83, -0.6)

    return { rails, pan, pad, cone: mergeGeometries([cone, coneTop]), tailLamp, plateArm }
  }, [])

  useEffect(
    () => () => {
      for (const g of Object.values(geo)) if (g instanceof THREE.BufferGeometry) g.dispose()
    },
    [geo],
  )

  return (
    <group>
      <Body g={withRevealOffset(geo.rails, r - 0.03)} mat={mats.aluminiumDark} />
      <Body g={withRevealOffset(geo.pan, r)} mat={mats.structural} />
      <Body g={withRevealOffset(geo.pad, r)} mat={mats.rubberSoft} />
      <Body g={withRevealOffset(geo.cone, r - 0.02)} mat={mats.carbonPanel} />
      <Body g={withRevealOffset(geo.plateArm, r - 0.02)} mat={mats.structural} cast={false} />
      <group ref={ledRef}>
        <Body g={withRevealOffset(geo.tailLamp, r)} mat={mats.tailLED} cast={false} receive={false} />
      </group>
    </group>
  )
}

/**
 * Rear swingarm: a cast aluminium truss that runs underslung from the pivot to
 * a billet axle carrier, with the shock acting on a rising-rate linkage.
 */
export function Swingarm({ mats }: { mats: BikeMaterials }): JSX.Element {
  const r = reliefOf('swingarm')
  const geo = useMemo(() => {
    const pivot = HARD.swingPivot
    const axle = HARD.rearAxle
    const dz = axle.z - pivot.z
    const dy = axle.y - pivot.y
    const len = Math.hypot(dz, dy)
    const angle = Math.atan2(dy, dz) // rotation about X that aligns +Z with the arm

    // main truss arm
    const arm = new THREE.BoxGeometry(0.13, 0.115, len)
    arm.rotateX(-angle)
    const armL = arm.clone()
    armL.translate(0.1, pivot.y + dy * 0.5, pivot.z + dz * 0.5)
    const armR = arm.clone()
    armR.translate(-0.1, pivot.y + dy * 0.5, pivot.z + dz * 0.5)
    const arms = mergeGeometries([armL, armR])

    // diagonal brace from the pivot area to the axle carrier
    const brace = new THREE.BoxGeometry(0.05, 0.055, len * 1.02)
    brace.rotateX(-angle)
    brace.rotateX(0)
    const braceL = brace.clone()
    braceL.translate(0.072, pivot.y + dy * 0.5 + 0.026, pivot.z + dz * 0.5 + 0.012)
    const braceR = brace.clone()
    braceR.translate(-0.072, pivot.y + dy * 0.5 + 0.026, pivot.z + dz * 0.5 + 0.012)
    const braces = mergeGeometries([braceL, braceR])

    // billet axle carriers + pivot boss
    const carrier = new THREE.CylinderGeometry(0.05, 0.05, 0.09, 18)
    carrier.rotateZ(Math.PI / 2)
    const carrierL = carrier.clone()
    carrierL.translate(0.115, axle.y, axle.z)
    const carrierR = carrier.clone()
    carrierR.translate(-0.115, axle.y, axle.z)
    const pivotBoss = new THREE.CylinderGeometry(0.048, 0.048, 0.3, 18)
    pivotBoss.rotateZ(Math.PI / 2)
    pivotBoss.translate(0, pivot.y, pivot.z)
    const carriers = mergeGeometries([carrierL, carrierR, pivotBoss])

    // shock: body + coil (drawn as a stack of rings) + clevis
    const shockBody = new THREE.CylinderGeometry(0.019, 0.019, 0.19, 12)
    const eyeTop = new THREE.CylinderGeometry(0.024, 0.024, 0.03, 12)
    eyeTop.rotateZ(Math.PI / 2)
    eyeTop.translate(0, 0.105, 0)
    const eyeBot = eyeTop.clone()
    eyeBot.translate(0, -0.21, 0)
    const shock = mergeGeometries([shockBody, eyeTop, eyeBot])
    const coilRings: THREE.BufferGeometry[] = []
    for (let i = 0; i < 9; i++) {
      const g = new THREE.TorusGeometry(0.032, 0.0055, 5, 18)
      g.rotateX(Math.PI / 2)
      g.translate(0, -0.07 + i * 0.017, 0)
      coilRings.push(g)
    }
    const coil = mergeGeometries(coilRings)

    // rising-rate linkage plates
    const link = new THREE.BoxGeometry(0.014, 0.11, 0.05)
    link.rotateX(0.5)
    const linkL = link.clone()
    linkL.translate(0.092, 0.5, -0.2)
    const linkR = link.clone()
    linkR.translate(-0.092, 0.5, -0.2)
    const links = mergeGeometries([linkL, linkR])

    return { arms, braces, carriers, shock, coil, links, shockPos: new THREE.Vector3(0, 0.585, -0.235) }
  }, [])

  useEffect(
    () => () => {
      for (const g of Object.values(geo)) if (g instanceof THREE.BufferGeometry) g.dispose()
    },
    [geo],
  )

  return (
    <group>
      <Body g={withRevealOffset(geo.arms, r)} mat={mats.aluminium} />
      <Body g={withRevealOffset(geo.braces, r)} mat={mats.aluminium} />
      <Body g={withRevealOffset(geo.carriers, r + 0.02)} mat={mats.aluminiumDark} />
      <Body g={withRevealOffset(geo.links, r + 0.02)} mat={mats.titanium} cast={false} />
      <group position={geo.shockPos} rotation={[THREE.MathUtils.degToRad(-38), 0, 0]}>
        <Body g={withRevealOffset(geo.shock, r + 0.03)} mat={mats.anodised} />
        <Body g={withRevealOffset(geo.coil, r + 0.03)} mat={mats.titanium} cast={false} />
      </group>
    </group>
  )
}
