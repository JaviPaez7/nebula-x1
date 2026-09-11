import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Director } from './three/Director'
import { buildTextureLibrary } from './three/textures'
import type { Quality } from './three/Bike'
import { scrollStore } from './core/scrollStore'
import { RANGES, SCROLL_VH } from './core/chapters'
import { loadManager } from './core/loadManager'
import { Captions, CAPTIONS } from './ui/Captions'
import { Chrome, Telemetry } from './ui/Chrome'
import { CockpitHud } from './ui/CockpitHud'
import { Callouts } from './ui/Callouts'
import { MobileParts } from './ui/MobileParts'
import { Loader } from './ui/Loader'
import { Fallback } from './ui/Fallback'
import { Footer, SpecSection } from './ui/SpecSheet'

/* ---------------------------------------------------------------- device */

/** Real WebGL availability, not a feature-detect library. */
function detectWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null)
    if (!gl) return false
    const lose = (gl as WebGLRenderingContext).getExtension('WEBGL_lose_context')
    lose?.loseContext()
    return true
  } catch {
    return false
  }
}

/**
 * Device tiering.
 *
 * Desktop gets the full machine with real shadows and full particle density;
 * tablets and phones get the same film with a lighter budget rather than a
 * stripped-down version of it.
 */
function pickQuality(): Quality {
  const w = window.innerWidth
  const mobile = w < 760
  const cores = navigator.hardwareConcurrency ?? 4
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8
  const dpr = window.devicePixelRatio || 1
  const constrained = cores <= 4 || mem <= 4

  if (mobile || constrained) {
    return { tier: 'medium', shadows: false, particleScale: 0.42, pixelRatio: Math.min(dpr, 1.5) }
  }
  if (cores >= 8 && w >= 1400) {
    return { tier: 'high', shadows: true, particleScale: 1, pixelRatio: Math.min(dpr, 2) }
  }
  return { tier: 'medium', shadows: w >= 1100, particleScale: 0.68, pixelRatio: Math.min(dpr, 1.75) }
}

/* --------------------------------------------------------- camera bridge */

/**
 * The callout layer lives in the DOM, outside the canvas, so it needs the live
 * camera to project its anchors. This is the one value that has to cross the
 * boundary, and it crosses exactly once.
 */
function CameraBridge({ onCamera }: { onCamera: (c: THREE.Camera) => void }) {
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    onCamera(camera)
  }, [camera, onCamera])
  return null
}

const noopEnter = () => undefined

/* ------------------------------------------------------------------- app */

export function App() {
  const [mode] = useState<'cinematic' | 'fallback'>(() =>
    typeof window === 'undefined' ? 'fallback' : detectWebGL() ? 'cinematic' : 'fallback',
  )
  const [started, setStarted] = useState(false)
  const [ready, setReady] = useState(false)
  const [camera, setCamera] = useState<THREE.Camera | null>(null)
  const quality = useMemo(() => pickQuality(), [])

  /* ---- scroll spine ---------------------------------------------------- */
  useEffect(() => {
    if (mode !== 'cinematic') return
    scrollStore.init()
    scrollStore.setLocked(true)
    return () => scrollStore.dispose()
  }, [mode])

  /* ---- genuine loading tasks ------------------------------------------ */
  useLayoutEffect(() => {
    if (mode !== 'cinematic') return
    const doneTex = loadManager.task('textures', 'Synthesising surfaces', 5)
    const doneFonts = loadManager.task('fonts', 'Loading typefaces', 1)
    const doneParticles = loadManager.task('particles', 'Building flow fields', 2)
    loadManager.task('materials', 'Compiling materials', 4)
    loadManager.task('shaders', 'Warming shaders', 3)
    loadManager.task('webgl', 'Starting renderer', 1)

    // Real work, generated synchronously on the main thread.
    const id = window.setTimeout(() => {
      buildTextureLibrary()
      doneTex()
      doneParticles()
    }, 0)

    let alive = true
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
    if (fonts?.ready) {
      fonts.ready.then(() => {
        if (alive) doneFonts()
      })
    } else {
      doneFonts()
    }
    return () => {
      alive = false
      window.clearTimeout(id)
    }
  }, [mode])

  /* ---- document height ------------------------------------------------- */
  useLayoutEffect(() => {
    if (mode !== 'cinematic') return
    const measure = () => scrollStore.remeasure()
    measure()
    const t1 = window.setTimeout(measure, 260)
    const t2 = window.setTimeout(measure, 1200)
    window.addEventListener('load', measure)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.removeEventListener('load', measure)
    }
  }, [mode])

  /* ---- enter ----------------------------------------------------------- */
  const enter = useCallback(() => {
    setStarted(true)
    scrollStore.setLocked(false)
  }, [])

  useEffect(() => {
    if (!ready || started) return
    const id = window.setTimeout(enter, 700)
    return () => window.clearTimeout(id)
  }, [ready, started, enter])

  /* ---- development navigation hook ------------------------------------ */
  // Used by the acceptance tooling to drive the film through the app's own
  // animation path instead of fighting it with window.scrollTo.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    ;(window as unknown as Record<string, unknown>).__NAV__ = {
      to(progress: number, seconds = 1.2) {
        scrollStore.scrollToProgressTimed(progress, seconds)
      },
      toChapter(id: string, seconds = 1.2) {
        const r = RANGES.find((c) => c.id === id)
        if (r) scrollStore.scrollToProgressTimed(r.start + (r.end - r.start) * 0.1, seconds)
      },
      jump(progress: number) {
        scrollStore.jumpTo(progress)
      },
      read: () => scrollStore.measureRanges(),
    }
    return () => {
      delete (window as unknown as Record<string, unknown>).__NAV__
    }
  }, [])

  const onDirectorReady = useCallback(() => setReady(true), [])
  const onCamera = useCallback((c: THREE.Camera) => setCamera(c), [])

  if (mode === 'fallback') {
    return (
      <>
        <Fallback reason="Static presentation" />
        <Loader done onEnter={noopEnter} />
      </>
    )
  }

  return (
    <>
      <div className="layer layer-canvas" id="top">
        <Canvas
          frameloop="always"
          dpr={quality.pixelRatio}
          shadows={quality.shadows}
          gl={{
            antialias: false,
            alpha: false,
            powerPreference: 'high-performance',
            stencil: false,
            depth: true,
          }}
          camera={{ fov: 24, near: 0.02, far: 90, position: [4.9, 2.5, 5.6] }}
        >
          <Director quality={quality} onReady={onDirectorReady} />
          <CameraBridge onCamera={onCamera} />
        </Canvas>
      </div>

      <div className="layer layer-grade" aria-hidden="true" />
      <div className="layer layer-grain" aria-hidden="true" />

      <Chrome />
      <Telemetry />
      <Captions captions={CAPTIONS} />
      <CockpitHud />
      {camera && <Callouts camera={camera} />}
      <MobileParts />

      {/* The only element that contributes document height. */}
      <div className="stage">
        <div className="scroll-track" style={{ height: `${SCROLL_VH}vh` }} aria-hidden="true" />
      </div>

      <SpecSection />
      <Footer />

      <Loader done={ready} onEnter={enter} />
    </>
  )
}
