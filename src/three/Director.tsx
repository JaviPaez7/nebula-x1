import { useEffect, useMemo, useRef, type JSX } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { BikeModel, createRigRefs, type Quality, type RigRefs } from './Bike'
import { Backdrop, Floor, Lights, type LightRig } from './Environment'
import { StudioEnvironment } from './StudioEnvironment'
import { createAirflow, createEnergyCells, createRoadDust } from './particles'
import { createGradePass } from './post'
import { createCameraState, evaluateCamera } from './shots'
import { scrollStore } from '../core/scrollStore'
import {
  applyPartTransform,
  createState,
  evaluate,
  partOffset,
  type ExperienceState,
} from '../core/experience'
import { materialChannels, setGlobalGlow, setReveal } from './materials'
import type { BikeMaterials } from './bikeMaterials'
import { applyBeautyCamera, BEAUTY_LIGHTS, beautyActive } from './beauty'
import { applyPartIsolation } from './isolate'
import { PART_COUNT } from './bikeParts'
import { loadManager } from '../core/loadManager'
import { domSignals, emitDomTick } from '../core/domSignals'

export type DirectorProps = {
  quality: Quality
  onReady: () => void
}

/**
 * The director.
 *
 * One component owns the entire frame. It reads scroll progress, evaluates the
 * experience state, writes the camera, the machine, the lighting desk, the
 * particles and the grade, publishes the DOM signals and then renders. React is
 * not involved in any of it, so a full pass through the film costs zero
 * reconciliations and the only per-frame allocations are the ones three.js
 * makes internally.
 */
export function Director({ quality, onReady }: DirectorProps): JSX.Element {
  const { gl, scene, camera, size, viewport } = useThree()

  const refs = useMemo<RigRefs>(() => createRigRefs(), [])
  const state = useMemo<ExperienceState>(() => createState(), [])
  const camState = useMemo(() => createCameraState(), [])

  const lightRig = useRef<LightRig | null>(null)
  const matsRef = useRef<BikeMaterials | null>(null)
  const fogRef = useRef<THREE.FogExp2 | null>(null)

  const airflow = useMemo(() => createAirflow(quality), [quality])
  const energy = useMemo(() => createEnergyCells(quality), [quality])
  const dust = useMemo(() => createRoadDust(quality), [quality])
  const grade = useMemo(() => createGradePass(quality), [quality])

  const elapsed = useRef(0)
  const frames = useRef(0)
  const sceneCalls = useRef(0)
  const [machineBounds] = useMemo(() => [new THREE.Box3()], [])
  void machineBounds

  /* ------------------------------------------------------------- renderer */
  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = 1
    gl.outputColorSpace = THREE.SRGBColorSpace
    gl.shadowMap.enabled = quality.shadows
    gl.shadowMap.type = THREE.PCFSoftShadowMap
    gl.setClearColor(0x000000, 1)
  }, [gl, quality.shadows])

  useEffect(() => {
    const dpr = Math.min(window.devicePixelRatio || 1, quality.pixelRatio)
    gl.setPixelRatio(dpr)
    grade.setSize(size.width, size.height, dpr)
    gl.setSize(size.width, size.height)
  }, [gl, grade, size, viewport, quality.pixelRatio])

  /* ------------------------------------------------------------ atmosphere */
  useEffect(() => {
    const fog = new THREE.FogExp2(0x05070a, 0.05)
    fogRef.current = fog
    scene.fog = fog
    return () => {
      scene.fog = null
    }
  }, [scene])

  /* ---------------------------------------------------------------- boot */
  // Real warm-up: compile every program the machine needs, draw a couple of
  // frames, and only then report ready. This is why the curtain never lifts
  // onto a stutter.
  useEffect(() => {
    let cancelled = false
    let frames = 0
    const step = () => {
      if (cancelled) return
      frames += 1
      if (frames === 1) {
        loadManager.complete('webgl')
        try {
          gl.compile(scene, camera)
        } catch {
          /* compilation is best-effort; the frame loop will retry */
        }
        loadManager.complete('shaders')
      }
      if (frames < 4) {
        requestAnimationFrame(step)
        return
      }
      loadManager.complete('materials')
      onReady()
    }
    const id = requestAnimationFrame(step)
    return () => {
      cancelled = true
      cancelAnimationFrame(id)
    }
  }, [gl, scene, camera, onReady])

  useEffect(
    () => () => {
      grade.dispose()
      airflow.mesh.geometry.dispose()
      airflow.material.dispose()
      energy.points.geometry.dispose()
      energy.material.dispose()
      dust.points.geometry.dispose()
      dust.material.dispose()
    },
    [grade, airflow, energy, dust],
  )

  const setLights = useMemo(() => (r: LightRig) => void (lightRig.current = r), [])
  const setMats = useMemo(
    () => (m: BikeMaterials) => {
      matsRef.current = m
    },
    [],
  )

  /* Development introspection hook — harmless in production, invaluable for
     checking draw calls, triangle counts and the live machine transform. */
  useEffect(() => {
    if (!import.meta.env.DEV) return
    ;(window as unknown as Record<string, unknown>).__NEBULA__ = {
      gl,
      scene,
      camera,
      refs,
      state,
      report() {
        let meshes = 0
        let visible = 0
        refs.model?.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) {
            meshes++
            if (o.visible) visible++
          }
        })
        return {
          calls: gl.info.render.calls,
          triangles: gl.info.render.triangles,
          programs: gl.info.programs?.length ?? -1,
          geometries: gl.info.memory.geometries,
          textures: gl.info.memory.textures,
          sceneChildren: scene.children.map((c) => `${c.type}:${c.name || '-'}`),
          camera: {
            p: camera.position.toArray().map((v) => +v.toFixed(2)),
            fov: (camera as THREE.PerspectiveCamera).fov,
          },
          bike: refs.model
            ? {
                visible: refs.model.visible,
                meshes,
                visibleMeshes: visible,
                pos: refs.model.position.toArray().map((v) => +v.toFixed(2)),
                partGroups: refs.groups.map((g) => (g ? g.children.length : -1)),
              }
            : null,
          reveal: materialChannels.uReveal.value,
          lights: lightRig.current
            ? {
                key: +lightRig.current.key.intensity.toFixed(1),
                rim: +lightRig.current.rim.intensity.toFixed(1),
                back: +lightRig.current.back.intensity.toFixed(1),
                wash: +lightRig.current.wash.intensity.toFixed(1),
                fill: +lightRig.current.fill.intensity.toFixed(2),
                head: +lightRig.current.headGlow.intensity.toFixed(1),
              }
            : null,
          exposure: state.exposure,
          backdropGlow: state.backdropGlow,
          fog: state.fog,
          sizes: {
            target: [grade.target.width, grade.target.height].join('x'),
            canvas: [gl.domElement.width, gl.domElement.height].join('x'),
            css: [gl.domElement.clientWidth, gl.domElement.clientHeight].join('x'),
            viewport: [viewport.width, viewport.height].join('x'),
            size: [size.width, size.height].join('x'),
            dpr: gl.getPixelRatio(),
          },
          directorFrames: frames.current,
          sceneCalls: sceneCalls.current,
        }
      },
    }
    return () => {
      delete (window as unknown as Record<string, unknown>).__NEBULA__
    }
  }, [gl, scene, camera, refs, state])

  /* ------------------------------------------------------------- the frame */
  useFrame((_rootState, delta) => {
    const dt = Math.min(delta, 1 / 20)
    elapsed.current += dt
    const t = elapsed.current

    scrollStore.update(dt)
    const p = scrollStore.smooth
    const vel = scrollStore.velocity / Math.max(dt, 1e-4)

    evaluate(p, state, vel, t)

    /* ---- camera ---- */
    evaluateCamera(p, camState, size.width / Math.max(1, size.height))
    const cam = camera as THREE.PerspectiveCamera
    cam.position.copy(camState.position)
    const shake = state.shake
    if (shake > 0.0001) {
      cam.position.x += Math.sin(t * 9.1) * shake
      cam.position.y += Math.sin(t * 11.7 + 1.3) * shake * 0.8
      cam.position.z += Math.sin(t * 7.3 + 2.1) * shake * 0.6
    }
    if (Math.abs(cam.fov - camState.fov) > 1e-4) {
      cam.fov = camState.fov
      cam.updateProjectionMatrix()
    }
    cam.up.set(0, 1, 0)
    cam.lookAt(camState.target)
    if (Math.abs(camState.roll) > 1e-5) cam.rotateZ(camState.roll)
    if (import.meta.env.DEV) {
      applyBeautyCamera(cam)
      applyPartIsolation(refs)
    }

    /* ---- machine ---- */
    refs.model.position.set(0, state.bikeOffsetY, state.bikeOffsetZ)
    refs.model.rotation.set(state.bikeRotX, state.bikeRotY, 0)

    setReveal(state.reveal, 0.3, 0.55 * (1 - Math.min(1, state.reveal * 0.9)))
    setGlobalGlow(0)
    void materialChannels

    for (let i = 0; i < PART_COUNT; i++) {
      applyPartTransform(i, state.explode, 0, t)
      const g = refs.groups[i]
      if (!g) continue
      const v = partOffset.v[i]
      const r = partOffset.r[i]
      g.position.set(v.x, v.y, v.z)
      g.rotation.set(r.x, r.y, r.z)
    }

    if (refs.frontWheel) refs.frontWheel.rotation.x = -state.wheelSpin
    if (refs.rearWheel) refs.rearWheel.rotation.x = -state.wheelSpin
    if (refs.motorRotor) {
      refs.motorRotor.rotation.x = state.spin
      refs.motorRotor.position.x = state.rotorOut * 0.42
    }
    if (refs.motorCase) refs.motorCase.position.y = state.rotorOut * 0.04
    if (refs.batteryMesh) refs.batteryMesh.position.y = state.batteryCore * 0.34
    if (refs.batteryCore) {
      refs.batteryCore.position.y = state.batteryCore * 0.06
      refs.batteryCore.rotation.z = state.batteryCore * 0.04
    }

    /* ---- lighting desk ---- */
    const rig = lightRig.current
    const beauty = import.meta.env.DEV && beautyActive()
    if (rig && beauty) {
      rig.key.intensity = BEAUTY_LIGHTS.key
      rig.rim.intensity = BEAUTY_LIGHTS.rim
      rig.back.intensity = BEAUTY_LIGHTS.back
      rig.wash.intensity = BEAUTY_LIGHTS.wash
      rig.fill.intensity = BEAUTY_LIGHTS.fill
      rig.accentFront.intensity = BEAUTY_LIGHTS.accentFront
      rig.accentRear.intensity = BEAUTY_LIGHTS.accentRear
      rig.headGlow.intensity = BEAUTY_LIGHTS.head
      rig.tailGlow.intensity = BEAUTY_LIGHTS.tail
    } else if (rig) {
      rig.key.intensity = state.lightKey * 78
      rig.rim.intensity = state.lightRim * 50
      rig.back.intensity = state.lightBack * 30
      rig.wash.intensity = state.lightWash * 42
      rig.fill.intensity = state.lightFill * 3.4
      rig.accentFront.intensity = state.lightAccentFront * 2.6
      rig.accentRear.intensity = state.lightAccentRear * 2.2
      rig.headGlow.intensity = state.lightHead * 18
      rig.tailGlow.intensity = state.lightTail * 1.8
    }

    const mats = matsRef.current
    if (mats) {
      mats.headlightLED.emissiveIntensity = 0.5 + state.lightHead * 4.6
      mats.tailLED.emissiveIntensity = 0.4 + state.lightTail * 3.6
      mats.accentLED.emissiveIntensity = 0.2 + state.lightHead * 2.0
      mats.cells.emissiveIntensity = 0.6 + state.energy * 2.4
    }

    /* ---- atmosphere ---- */
    const fog = fogRef.current
    if (fog) {
      fog.density = state.fog
      fog.color.setRGB(
        0.02 + 0.02 * state.backdropGlow,
        0.026 + 0.028 * state.backdropGlow,
        0.038 + 0.04 * state.backdropGlow,
      )
    }

    /* ---- particles ---- */
    airflow.set(state.airflow, state.airSpeed)
    airflow.update(t)
    airflow.mesh.visible = state.airflow > 0.01
    energy.set(beauty ? 0 : state.energy)
    energy.update(t)
    dust.set(beauty ? 0 : state.dust, state.dustSpread)
    dust.update(t)

    /* ---- grade ---- */
    grade.uniforms.uTime.value = t
    grade.uniforms.uVignette.value = beauty ? 0.35 : state.vignette
    grade.uniforms.uGrain.value = state.grain
    grade.uniforms.uSpeedSmear.value = state.speedSmear
    grade.uniforms.uExposure.value = beauty ? 1.12 : state.exposure
    grade.uniforms.uAberration.value = 0.42 + state.speedSmear * 1.3

    /* ---- publish for the DOM layer ---- */
    domSignals.progress = p
    domSignals.rawProgress = scrollStore.progress
    domSignals.velocity = vel
    domSignals.elapsed = t
    domSignals.cockpit = state.cockpit
    domSignals.specs = state.specsReveal
    domSignals.explode = state.explode
    domSignals.lightHead = state.lightHead
    domSignals.ride = 1 - Math.max(0, 1 - state.dust)
    domSignals.exposure = beauty ? 1.35 : state.exposure
    emitDomTick()

    /* ---- draw ---- */
    gl.toneMappingExposure = 1
    frames.current += 1
    if (frames.current === 3) sceneCalls.current = gl.info.render.calls
    if ((window as unknown as Record<string, unknown>).__NO_PASS__ === true) {
      gl.setRenderTarget(null)
      gl.render(scene, cam)
    } else {
      grade.render(gl, scene, cam)
    }
  }, 1)

  return (
    <>
      <StudioEnvironment intensity={1.15} />
      <Backdrop quality={quality} />
      <Floor quality={quality} receiveShadow={quality.shadows} />
      <Lights quality={quality} onReady={setLights} />
      <primitive object={airflow.mesh} />
      <primitive object={energy.group} />
      <primitive object={dust.points} />
      <BikeModel refs={refs} quality={quality} onMaterials={setMats} />
    </>
  )
}
