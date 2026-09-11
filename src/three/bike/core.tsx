import { useEffect, useMemo, useRef, type JSX } from 'react'
import * as THREE from 'three'
import type { BikeMaterials } from '../bikeMaterials'
import { extruded, mergeGeometries, smoothProfile, withRevealOffset } from '../geometry'
import { Body } from './common'
import { HARD, reliefOf } from '../bikeParts'

/* ---------------------------------------------------------------- battery */

export type BatteryRefs = {
  caseRef: (o: THREE.Group | null) => void
  coreRef: (o: THREE.Group | null) => void
  meshRef: (o: THREE.Group | null) => void
}

/**
 * Structural battery enclosure.
 *
 * At rest it is a sealed, stressed member of the frame. As chapter 04 opens it
 * up, the lid and side plates peel away to expose the module stack inside —
 * pouches, busbars, cooling plates and the contactors.
 */
export function Battery({ mats, refs }: { mats: BikeMaterials; refs: BatteryRefs }): JSX.Element {
  const r = reliefOf('battery')
  const geo = useMemo(() => {
    // --- case: tapered side plates drawn as a smooth extruded profile
    const profile = smoothProfile(
      [
        [-0.33, 0.05],
        [-0.28, 0.31],
        [-0.1, 0.4],
        [0.2, 0.36],
        [0.34, 0.16],
        [0.3, -0.12],
        [0.05, -0.24],
        [-0.2, -0.22],
        [-0.31, -0.1],
      ],
      4,
    )
    const sidePlateGeo = extruded(profile, 0.02, { bevel: 0.008 })
    const sideL = sidePlateGeo.clone()
    sideL.rotateY(Math.PI / 2)
    sideL.translate(0.185, 0, 0)
    const sideR = sidePlateGeo.clone()
    sideR.rotateY(Math.PI / 2)
    sideR.translate(-0.185, 0, 0)
    const sides = mergeGeometries([sideL, sideR])

    // --- module cage and rails
    const railA = new THREE.BoxGeometry(0.36, 0.03, 0.66)
    railA.translate(0, 0.33, 0.02)
    const railB = railA.clone()
    railB.translate(0, -0.35, 0)
    const rails = mergeGeometries([railA, railB])

    // --- front bulkhead with the charge port
    const bulkhead = new THREE.BoxGeometry(0.34, 0.64, 0.045)
    bulkhead.translate(0, 0.0, 0.35)
    const port = new THREE.CylinderGeometry(0.052, 0.052, 0.03, 18)
    port.rotateX(Math.PI / 2)
    port.translate(0, 0.15, 0.372)
    const portRing = new THREE.TorusGeometry(0.055, 0.007, 6, 20)
    portRing.translate(0, 0.15, 0.383)
    const bulk = mergeGeometries([bulkhead, port, portRing])

    // --- lid (lifts away in the exploded view)
    const lid = new THREE.BoxGeometry(0.38, 0.035, 0.7)
    lid.translate(0, 0.315, 0.02)
    const lidFin = new THREE.BoxGeometry(0.2, 0.02, 0.62)
    lidFin.translate(0, 0.34, 0.02)
    const lidAll = mergeGeometries([lid, lidFin])

    // --- module stack: pouches in a 2 x 6 grid with copper busbars between
    const pouchW = 0.128
    const pouchH = 0.29
    const pouchD = 0.098
    const moduleGeos: THREE.BufferGeometry[] = []
    const pouch = new THREE.BoxGeometry(pouchW, pouchH, pouchD)
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 6; col++) {
        const g = pouch.clone()
        g.translate(
          row === 0 ? -0.072 : 0.072,
          0.12 - 0.0,
          -0.27 + col * 0.104,
        )
        moduleGeos.push(g)
      }
    }
    const modules = mergeGeometries(moduleGeos)

    const busbars: THREE.BufferGeometry[] = []
    for (let col = 0; col < 6; col++) {
      const g = new THREE.BoxGeometry(0.19, 0.012, 0.016)
      g.translate(0, 0.275, -0.27 + col * 0.104)
      busbars.push(g)
    }
    const bus = mergeGeometries(busbars)

    // --- cooling plate sandwiched under the stack
    const plate = new THREE.BoxGeometry(0.34, 0.022, 0.66)
    plate.translate(0, -0.06, 0.0)
    const channel = new THREE.BoxGeometry(0.3, 0.012, 0.6)
    channel.translate(0, -0.075, 0.0)
    const cooling = mergeGeometries([plate, channel])

    // --- contactors / BMS board at the rear
    const bms = new THREE.BoxGeometry(0.26, 0.1, 0.1)
    bms.translate(0, 0.0, -0.36)
    const bmsChip = new THREE.BoxGeometry(0.16, 0.02, 0.06)
    bmsChip.translate(0, 0.06, -0.36)
    const bmsAll = mergeGeometries([bms, bmsChip])

    // --- energy conduits: two copper lines running to the drive unit
    const conduits: THREE.BufferGeometry[] = []
    for (const x of [0.1, -0.1]) {
      const g = new THREE.CylinderGeometry(0.016, 0.016, 0.42, 10)
      g.rotateX(Math.PI / 2)
      g.translate(x, -0.02, -0.6)
      conduits.push(g)
    }
    const conduit = mergeGeometries(conduits)

    return { sides, rails, bulk, lidAll, modules, bus, cooling, bmsAll, conduit }
  }, [])

  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose())
    },
    [geo],
  )

  const cellRef = useRef<THREE.Group>(null)

  return (
    <group position={[0, 0.54, 0.03]}>
      <group ref={refs.caseRef}>
        <Body g={withRevealOffset(geo.sides, r)} mat={mats.carbonMatte} />
        <Body g={withRevealOffset(geo.rails, r)} mat={mats.aluminiumDark} />
        <Body g={withRevealOffset(geo.bulk, r + 0.02)} mat={mats.carbonMatte} />
        <Body g={withRevealOffset(geo.conduit, r - 0.02)} mat={mats.copper} cast={false} />
      </group>
      <group ref={refs.coreRef}>
        <group ref={cellRef}>
          <Body g={withRevealOffset(geo.modules, r + 0.01)} mat={mats.cells} />
          <Body g={withRevealOffset(geo.bus, r + 0.01)} mat={mats.copper} cast={false} />
        </group>
        <Body g={withRevealOffset(geo.cooling, r)} mat={mats.aluminiumDark} />
        <Body g={withRevealOffset(geo.bmsAll, r + 0.02)} mat={mats.structural} />
      </group>
      <group ref={refs.meshRef}>
        <Body g={withRevealOffset(geo.lidAll, r + 0.04)} mat={mats.carbonPanel} />
      </group>
    </group>
  )
}

/* ------------------------------------------------------------------ motor */

export type MotorRefs = {
  caseRef: (o: THREE.Group | null) => void
  rotorRef: (o: THREE.Group | null) => void
}

/**
 * Transverse-flux permanent-magnet drive unit.
 *
 * Housing with cooling fins and an integrated inverter on top, a stator can
 * visible once the case is split, the rotor with its magnet segments, and the
 * reduction housing that takes drive out to the belt.
 */
export function Motor({ mats, refs }: { mats: BikeMaterials; refs: MotorRefs }): JSX.Element {
  const r = reliefOf('motor')
  const geo = useMemo(() => {
    const radius = 0.195
    const width = 0.2

    const can = new THREE.CylinderGeometry(radius, radius, width, 34, 1, true)
    can.rotateZ(Math.PI / 2)

    const fins: THREE.BufferGeometry[] = []
    for (let i = 0; i < 7; i++) {
      const g = new THREE.TorusGeometry(radius + 0.004, 0.0075, 5, 30)
      g.rotateY(Math.PI / 2)
      g.translate(-width * 0.4 + i * (width * 0.8) / 6, 0, 0)
      fins.push(g)
    }
    const finAll = mergeGeometries(fins)

    const endCap = new THREE.CylinderGeometry(radius * 1.01, radius * 0.96, 0.03, 34)
    endCap.rotateZ(Math.PI / 2)
    const capL = endCap.clone()
    capL.translate(width * 0.5 + 0.014, 0, 0)
    const capR = endCap.clone()
    capR.translate(-width * 0.5 - 0.014, 0, 0)
    const caps = mergeGeometries([capL, capR])

    // inverter / controller sitting on top of the can
    const inverter = new THREE.BoxGeometry(0.24, 0.075, 0.24)
    inverter.translate(0, radius * 0.86, -0.01)
    const inverterFin: THREE.BufferGeometry[] = []
    for (let i = 0; i < 6; i++) {
      const g = new THREE.BoxGeometry(0.23, 0.012, 0.014)
      g.translate(0, radius * 0.86 + 0.042, -0.11 + i * 0.04)
      inverterFin.push(g)
    }
    const inverters = mergeGeometries([inverter, ...inverterFin])

    // stator can: slotted laminations around the inside of the housing
    const statorGeos: THREE.BufferGeometry[] = []
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2
      const g = new THREE.BoxGeometry(width * 0.86, 0.028, 0.022)
      g.translate(0, Math.cos(a) * (radius - 0.028), Math.sin(a) * (radius - 0.028))
      g.rotateX(-a)
      statorGeos.push(g)
    }
    const stator = mergeGeometries(statorGeos)

    // rotor: shaft, hub disc and magnet segments
    const shaft = new THREE.CylinderGeometry(0.032, 0.032, width + 0.34, 16)
    shaft.rotateZ(Math.PI / 2)
    const hubDisc = new THREE.CylinderGeometry(radius * 0.72, radius * 0.72, width * 0.5, 30)
    hubDisc.rotateZ(Math.PI / 2)
    const magnets: THREE.BufferGeometry[] = []
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2
      const g = new THREE.BoxGeometry(width * 0.78, 0.03, 0.05)
      g.translate(0, Math.cos(a) * (radius - 0.062), Math.sin(a) * (radius - 0.062))
      g.rotateX(-a)
      magnets.push(g)
    }
    const rotorAll = mergeGeometries([shaft, hubDisc, ...magnets])

    // reduction housing on the outboard side, with the belt pulley
    const reduction = new THREE.CylinderGeometry(0.085, 0.085, 0.07, 22)
    reduction.rotateZ(Math.PI / 2)
    const reductionHousing = new THREE.BoxGeometry(0.07, 0.2, 0.19)
    reductionHousing.translate(-0.115, -0.02, 0)
    const pulley = new THREE.CylinderGeometry(0.062, 0.062, 0.032, 26)
    pulley.rotateZ(Math.PI / 2)
    pulley.translate(-0.175, -0.02, 0)
    const pulleyTeeth: THREE.BufferGeometry[] = []
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2
      const g = new THREE.BoxGeometry(0.03, 0.012, 0.012)
      g.translate(0, Math.cos(a) * 0.064, Math.sin(a) * 0.064)
      g.rotateX(-a)
      pulleyTeeth.push(g)
    }
    const drive = mergeGeometries([reduction, reductionHousing, pulley, ...pulleyTeeth])

    // coolant lines
    const lineGeos: THREE.BufferGeometry[] = []
    for (const [x, y] of [
      [0.09, 0.2],
      [-0.03, 0.2],
    ]) {
      const g = new THREE.CylinderGeometry(0.013, 0.013, 0.3, 10)
      g.rotateX(Math.PI / 2.4)
      g.translate(x, radius * 0.7 + y * 0.2, 0.21)
      lineGeos.push(g)
    }
    const lines = mergeGeometries(lineGeos)

    return { can, finAll, caps, inverters, stator, rotorAll, drive, lines }
  }, [])

  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose())
    },
    [geo],
  )

  return (
    <group position={[0, 0.44, -0.26]}>
      <group ref={refs.caseRef}>
        <Body g={withRevealOffset(geo.can, r)} mat={mats.aluminiumDark} />
        <Body g={withRevealOffset(geo.finAll, r + 0.01)} mat={mats.aluminium} cast={false} />
        <Body g={withRevealOffset(geo.caps, r + 0.02)} mat={mats.aluminium} />
        <Body g={withRevealOffset(geo.inverters, r + 0.05)} mat={mats.anodised} />
        <Body g={withRevealOffset(geo.lines, r - 0.02)} mat={mats.structural} cast={false} />
        <Body g={withRevealOffset(geo.drive, r + 0.02)} mat={mats.aluminium} />
      </group>
      <group ref={refs.rotorRef}>
        <Body g={withRevealOffset(geo.stator, r + 0.03)} mat={mats.copper} cast={false} />
        <Body g={withRevealOffset(geo.rotorAll, r + 0.06)} mat={mats.titanium} />
      </group>
    </group>
  )
}

/* ------------------------------------------------------------------ frame */

/**
 * Bonded aluminium monocoque: two machined spars that clamp the battery,
 * a headstock, the swingarm pivot plates and the shock crossmember.
 */
export function Chassis({ mats }: { mats: BikeMaterials }): JSX.Element {
  const r = reliefOf('chassis')
  const geo = useMemo(() => {
    // Machined spar profile in the XZ plane, extruded across the bike width.
    const sparProfile = smoothProfile(
      [
        [-0.52, 0.0],
        [-0.3, 0.028],
        [0.06, 0.052],
        [0.33, 0.05],
        [0.46, 0.02],
        [0.4, -0.045],
        [0.02, -0.062],
        [-0.32, -0.05],
      ],
      4,
    )
    const spar = extruded(sparProfile, 0.028, { bevel: 0.007 })
    const sparL = spar.clone()
    sparL.rotateY(Math.PI / 2)
    sparL.translate(0.212, 0.82, -0.06)
    const sparR = spar.clone()
    sparR.rotateY(Math.PI / 2)
    sparR.translate(-0.212, 0.82, -0.06)
    const spars = mergeGeometries([sparL, sparR])

    // headstock: an inclined tube wrapped around the steering axis
    const head = new THREE.CylinderGeometry(0.058, 0.062, 0.24, 20)
    head.rotateZ(-Math.atan(Math.tan(0.4363)))
    head.rotateZ(0.4363)
    head.translate(0, 0.97, 0.36)
    const headBrace = new THREE.BoxGeometry(0.44, 0.06, 0.1)
    headBrace.translate(0, 0.9, 0.33)
    const headstock = mergeGeometries([head, headBrace])

    // swingarm pivot plates
    const plate = new THREE.BoxGeometry(0.024, 0.2, 0.2)
    const plateL = plate.clone()
    plateL.translate(0.2, 0.5, -0.13)
    const plateR = plate.clone()
    plateR.translate(-0.2, 0.5, -0.13)
    const plateCross = new THREE.BoxGeometry(0.4, 0.05, 0.06)
    plateCross.translate(0, 0.44, -0.11)
    const plates = mergeGeometries([plateL, plateR, plateCross])

    // shock crossmember / upper mount
    const cross = new THREE.BoxGeometry(0.42, 0.05, 0.07)
    cross.translate(0, 0.79, -0.26)
    const mount = new THREE.BoxGeometry(0.07, 0.09, 0.05)
    mount.translate(0, 0.75, -0.255)
    const crossmember = mergeGeometries([cross, mount])

    // footrest hangers and pegs
    const hanger = new THREE.BoxGeometry(0.026, 0.13, 0.1)
    hanger.rotateX(0.35)
    const hangerL = hanger.clone()
    hangerL.translate(0.185, 0.38, -0.24)
    const hangerR = hanger.clone()
    hangerR.translate(-0.185, 0.38, -0.24)
    const pegs: THREE.BufferGeometry[] = []
    for (const sx of [1, -1]) {
      const g = new THREE.CylinderGeometry(0.014, 0.014, 0.085, 10)
      g.rotateZ(Math.PI / 2)
      g.translate(sx * 0.235, 0.37, -0.25)
      pegs.push(g)
    }
    const controls = mergeGeometries([hangerL, hangerR, ...pegs])

    // side stand on the machine's left
    const stand = new THREE.CylinderGeometry(0.013, 0.016, 0.34, 10)
    stand.rotateX(0.42)
    stand.rotateZ(-0.22)
    stand.translate(0.235, 0.17, -0.06)
    const standFoot = new THREE.BoxGeometry(0.05, 0.014, 0.07)
    standFoot.translate(0.29, 0.01, 0.06)
    const sideStand = mergeGeometries([stand, standFoot])

    return { spars, headstock, plates, crossmember, controls, sideStand }
  }, [])

  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose())
    },
    [geo],
  )

  return (
    <group>
      <Body g={withRevealOffset(geo.spars, r)} mat={mats.aluminium} />
      <Body g={withRevealOffset(geo.headstock, r + 0.03)} mat={mats.aluminium} />
      <Body g={withRevealOffset(geo.plates, r + 0.02)} mat={mats.aluminiumDark} />
      <Body g={withRevealOffset(geo.crossmember, r + 0.02)} mat={mats.aluminiumDark} />
      <Body g={withRevealOffset(geo.controls, r - 0.02)} mat={mats.anodised} cast={false} />
      <Body g={withRevealOffset(geo.sideStand, r - 0.03)} mat={mats.anodised} cast={false} />
    </group>
  )
}

/* --------------------------------------------------------------- bodywork */

/**
 * Bodywork: the tank shroud that wraps the front of the battery, the seat
 * unit, radiator shrouds, a belly pan and the little aero winglets that keep
 * the front end planted.
 */
export function Bodywork({ mats }: { mats: BikeMaterials }): JSX.Element {
  const r = reliefOf('bodywork')
  const geo = useMemo(() => {
    /**
     * Tank shroud.
     *
     * Authored as a side profile that follows the spine of the machine, then
     * extruded across the bike. Extruding in the XY plane (rather than the
     * XZ plane the rest of the panels use) means the shell's two end caps face
     * fore and aft along the machine instead of outwards as flat discs — which
     * is what a moulded tank actually looks like, and what gives the highlight
     * somewhere to run.
     */
    const tankProfile = smoothProfile(
      [
        [-0.6, 0.665],
        [-0.42, 0.84],
        [-0.12, 0.96],
        [0.18, 1.0],
        [0.44, 0.97],
        [0.6, 0.88],
        [0.62, 0.79],
        [0.42, 0.72],
        [0.06, 0.68],
        [-0.3, 0.67],
      ],
      5,
    )
    const tank = extruded(tankProfile, 0.36, { bevel: 0.014, curveSegments: 8 })
    const tp = tank.attributes.position as THREE.BufferAttribute
    const v = new THREE.Vector3()
    for (let i = 0; i < tp.count; i++) {
      v.fromBufferAttribute(tp, i)
      // Crown the shell across its width so the flanks curve back toward the
      // battery and the crown catches the overhead softbox.
      const across = THREE.MathUtils.clamp(Math.abs(v.z) / 0.18, 0, 1)
      v.x *= 1 - 0.075 * across * across
      tp.setXYZ(i, v.x, v.y, v.z)
    }
    tp.needsUpdate = true
    tank.computeVertexNormals()

    // radiator shrouds / knee panels either side of the battery
    const kneeProfile = smoothProfile(
      [
        [-0.2, -0.16],
        [-0.14, 0.1],
        [0.0, 0.18],
        [0.16, 0.12],
        [0.2, -0.06],
        [0.05, -0.2],
        [-0.1, -0.2],
      ],
      4,
    )
    const knee = extruded(kneeProfile, 0.03, { bevel: 0.008 })
    const kneeL = knee.clone()
    kneeL.rotateY(Math.PI / 2)
    kneeL.translate(0.235, 0.76, 0.12)
    const kneeR = knee.clone()
    kneeR.rotateY(Math.PI / 2)
    kneeR.translate(-0.235, 0.76, 0.12)
    const knees = mergeGeometries([kneeL, kneeR])

    // belly pan under the battery
    const belly = new THREE.BoxGeometry(0.34, 0.07, 0.56)
    belly.translate(0, 0.19, 0.03)
    const bellyKeel = new THREE.BoxGeometry(0.2, 0.05, 0.5)
    bellyKeel.translate(0, 0.145, 0.02)
    const pan = mergeGeometries([belly, bellyKeel])

    // aero winglets at the front of the shrouds
    const wing = new THREE.BoxGeometry(0.115, 0.01, 0.075)
    wing.rotateZ(-0.3)
    wing.rotateY(0.2)
    const wingL = wing.clone()
    wingL.translate(0.245, 0.9, 0.29)
    const wingR = wing.clone()
    wingR.translate(-0.245, 0.9, 0.29)
    const wings = mergeGeometries([wingL, wingR])

    // rear hugger over the tyre
    const hugger = new THREE.CylinderGeometry(0.37, 0.37, 0.17, 40, 4, true, Math.PI * 1.02, Math.PI * 0.66)
    hugger.rotateZ(Math.PI / 2)
    const hp = hugger.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < hp.count; i++) {
      v.fromBufferAttribute(hp, i)
      const shrink = 0.9 + 0.1 * (1 - Math.min(1, Math.abs(v.x) / 0.085))
      hp.setXYZ(i, v.x, v.y * shrink, v.z * shrink)
    }
    hp.needsUpdate = true
    hugger.computeVertexNormals()
    hugger.translate(0, 0.35, -0.66)

    // chain / belt guard
    const guard = new THREE.BoxGeometry(0.026, 0.05, 0.6)
    guard.rotateX(-0.06)
    guard.translate(0.15, 0.36, -0.44)

    return { shroud: tank, knees, pan, wings, hugger, guard }
  }, [])

  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose())
    },
    [geo],
  )

  return (
    <group>
      <Body g={withRevealOffset(geo.shroud, r)} mat={mats.carbonPanel} />
      <Body g={withRevealOffset(geo.knees, r + 0.01)} mat={mats.carbonPanel} />
      <Body g={withRevealOffset(geo.pan, r - 0.02)} mat={mats.carbonMatte} />
      <Body g={withRevealOffset(geo.wings, r + 0.03)} mat={mats.carbonPanel} cast={false} />
      <Body g={withRevealOffset(geo.hugger, r - 0.03)} mat={mats.carbonMatte} />
      <Body g={withRevealOffset(geo.guard, r - 0.02)} mat={mats.structural} cast={false} />
    </group>
  )
}

/**
 * Final drive: a carbon-reinforced belt running from the reduction pulley to
 * the rear wheel sprocket. Modelled as a closed loop so it reads correctly
 * from every camera angle.
 */
export function BeltDrive({ mats }: { mats: BikeMaterials }): JSX.Element {
  const r = reliefOf('swingarm')
  const geo = useMemo(() => {
    const ax = HARD.rearAxle
    const from = new THREE.Vector3(-0.175, 0.42, -0.26)
    const to = new THREE.Vector3(0.0, ax.y, ax.z)
    const beltR = 0.062
    const rearR = 0.13

    // approximate the loop with a thin extruded ring around both pulleys
    const segs = 40
    const pts: THREE.Vector3[] = []
    const dx = to.z - from.z
    const dy = to.y - from.y
    const baseAngle = Math.atan2(dy, dx)
    for (let i = 0; i <= segs; i++) {
      const t = i / segs
      const a = baseAngle + (t - 0.5) * 0.0001
      void a
      const p = new THREE.Vector3().lerpVectors(from, to, t)
      p.y += Math.sin(t * Math.PI) * 0.0
      pts.push(p)
    }
    const geos: THREE.BufferGeometry[] = []
    for (let i = 0; i < segs; i++) {
      const a = pts[i]
      const b = pts[i + 1]
      const len = a.distanceTo(b)
      const mid = a.clone().add(b).multiplyScalar(0.5)
      const g = new THREE.BoxGeometry(0.022, 0.014, len * 1.06)
      g.rotateX(-Math.atan2(b.y - a.y, b.z - a.z))
      g.translate(-0.175, mid.y, mid.z)
      geos.push(g)
    }
    // wrap the belt around the rear sprocket
    const wrap = new THREE.TorusGeometry(rearR, 0.011, 6, 30)
    wrap.rotateY(Math.PI / 2)
    wrap.translate(-0.175, ax.y, ax.z)
    const sprocket = new THREE.CylinderGeometry(rearR * 0.82, rearR * 0.82, 0.028, 28)
    sprocket.rotateZ(Math.PI / 2)
    sprocket.translate(-0.175, ax.y, ax.z)

    void beltR
    return { belt: mergeGeometries(geos), wrap, sprocket }
  }, [])

  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose())
    },
    [geo],
  )

  return (
    <group>
      <Body g={withRevealOffset(geo.belt, r)} mat={mats.structural} cast={false} />
      <Body g={withRevealOffset(geo.wrap, r)} mat={mats.structural} cast={false} />
      <Body g={withRevealOffset(geo.sprocket, r)} mat={mats.aluminiumDark} />
    </group>
  )
}
