import Lenis from 'lenis'
import { clamp, damp, smootherstep } from './math'

/**
 * The scroll spine.
 *
 * A single Lenis instance provides inertial scrolling, and the normalised
 * document scroll position (`progress`, 0..1) is the one and only timeline
 * value in the whole application. Nothing is triggered by "entering the
 * viewport"; every animation in the experience is a pure function of this
 * number, so scrolling backwards runs the film backwards by construction.
 */
class ScrollStore {
  /** raw normalised scroll position, updated every frame */
  progress = 0
  /** smoothed progress, used for anything that would look jittery raw */
  smooth = 0
  /** signed progress delta for the current frame (normalised units / second) */
  velocity = 0

  /** true once the loader has handed control to the user */
  interactive = false
  /** true when prefers-reduced-motion asked us to skip inertial scrolling */
  reducedMotion = false

  private lenis: Lenis | null = null
  private rafId = 0
  private maxScroll = 1
  private lastProgress = 0
  private listeners = new Set<(p: number) => void>()
  private resizeListeners = new Set<() => void>()

  /** Distance in px that corresponds to progress = 1. */
  get scrollLength() {
    return this.maxScroll
  }

  init() {
    if (typeof window === 'undefined') return

    this.reducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

    if (!this.reducedMotion) {
      this.lenis = new Lenis({
        // A fairly long duration keeps the film cinematic without feeling laggy.
        duration: 1.15,
        // Exponential ease-out: fast pickup, long graceful settle.
        easing: (t: number) => 1 - Math.pow(1 - t, 3.2),
        wheelMultiplier: 1,
        touchMultiplier: 1.6,
        // Native touch scrolling on phones feels better than a hijacked one.
        smoothWheel: true,
        syncTouch: false,
        autoRaf: false,
      })
    }

    // Lenis drives scrollTop itself; we integrate it on our own RAF so the
    // 3D render, the DOM overlays and the scroll position always agree.
    const tick = (time: number) => {
      this.rafId = requestAnimationFrame(tick)
      this.lenis?.raf(time)
      this.sample()
    }
    this.rafId = requestAnimationFrame(tick)

    window.addEventListener('resize', this.handleResize, { passive: true })
    window.addEventListener('orientationchange', this.handleResize, { passive: true })
    this.handleResize()
  }

  private handleResize = () => {
    this.measure()
    for (const l of this.resizeListeners) l()
  }

  private measure() {
    const doc = document.documentElement
    // The specification sheet is real, scrollable content that sits after the
    // film. Progress 1.0 must coincide with the moment the sheet arrives, so
    // the last screenful of the document is excluded from the timeline.
    const sheet = document.getElementById('specifications')
    const footer = document.querySelector('.site-footer') as HTMLElement | null
    const tail = (sheet?.offsetHeight ?? 0) + (footer?.offsetHeight ?? 0)
    this.maxScroll = Math.max(1, doc.scrollHeight - window.innerHeight - tail)
  }

  /** Called automatically when the document height changes (fonts, images…). */
  remeasure() {
    this.measure()
  }

  private sample() {
    const y = this.lenis ? this.lenis.scroll : window.scrollY || window.pageYOffset || 0
    const p = clamp(y / this.maxScroll)
    const prev = this.progress
    this.progress = p
    this.velocity = p - prev
    this.smoothTarget = p
  }

  private smoothTarget = 0

  /** Advance the smoothed values. Must be called once per rendered frame. */
  update(dt: number) {
    // Asymmetric damping: settle quickly when the user stops, but keep a hint
    // of inertia while the wheel is still spinning.
    const lambda = this.velocity === 0 ? 7.5 : 11
    this.smooth = damp(this.smooth, this.smoothTarget, lambda, dt)

    // Retire the velocity signal once the frame-to-frame delta goes to zero.
    if (Math.abs(this.progress - this.lastProgress) < 1e-6) this.velocity *= 0.82
    this.lastProgress = this.progress
  }

  /** Scroll to an absolute progress value (used by chapter navigation). */
  scrollToProgress(p: number, immediate = false) {
    const targetY = clamp(p) * this.maxScroll
    if (this.lenis) {
      this.lenis.scrollTo(targetY, immediate ? { immediate: true } : { duration: 1.35 })
    } else {
      window.scrollTo({ top: targetY, behavior: immediate ? 'auto' : 'smooth' })
    }
  }

  /**
   * Scroll so that progress *p* is reached in about `seconds`.
   *
   * The duration is derived from the distance travelled rather than fixed, so
   * jumping two chapters feels deliberate while nudging to the next one still
   * feels immediate. Only one animation is ever in flight: Lenis is told to
   * stop first, otherwise a second call would be ignored mid-flight (its own
   * `isScrolling` guard) and the navigation would appear to do nothing.
   *
   * When the visitor has asked for reduced motion there is no inertial tween
   * to run, so navigation and deep links cut straight to the destination. That
   * keeps the chapter rail fully functional for them instead of silently doing
   * nothing.
   */
  scrollToProgressTimed(p: number, seconds: number) {
    this.generation += 1
    const targetY = clamp(p) * this.maxScroll
    if (this.reducedMotion) {
      window.scrollTo({ top: targetY, behavior: 'auto' })
      this.progress = clamp(p)
      this.smoothTarget = this.progress
      this.smooth = this.progress
      return
    }
    if (!this.lenis) {
      window.scrollTo({ top: targetY, behavior: 'smooth' })
      return
    }
    this.lenis.stop()
    this.lenis.scrollTo(targetY, {
      duration: seconds,
      easing: (t: number) => 1 - Math.pow(1 - t, 3),
      force: true,
      lock: true,
      onComplete: () => this.lenis?.start(),
    })
  }

  /** A stable absolute measurement, for tooling and diagnostics. */
  measureRanges() {
    const y = this.lenis ? this.lenis.scroll : window.scrollY
    return {
      y: Math.round(y),
      max: Math.round(this.maxScroll),
      progress: Math.round(this.progress * 10000) / 10000,
      gen: this.generation,
      settling: this.lenis ? this.lenis.isScrolling : false,
    }
  }

  /**
   * Increments every time a programmatic scroll starts.
   *
   * Tooling needs to tell "the animation has not begun yet" apart from "the
   * animation has already settled", and comparing values alone cannot
   * distinguish the two — a test can sample the start value, see it stable, and
   * conclude the move is finished.
   */
  generation = 0

  /** Stop/start the user's ability to scroll (used by the intro curtain). */
  setLocked(locked: boolean) {
    if (this.lenis) {
      if (locked) this.lenis.stop()
      else this.lenis.start()
    }
    document.documentElement.classList.toggle('is-locked', locked)
  }

  /** Snap the store to a progress value without animating (deep links, restores). */
  jumpTo(p: number) {
    this.generation += 1
    this.scrollToProgress(p, true)
    this.progress = clamp(p)
    this.smoothTarget = this.progress
    this.smooth = this.progress
  }

  /**
   * Deep links.
   *
   * `#specifications` and `#reserve` are real content links; every other hash
   * that matches a chapter id moves the film to that chapter. Both directions
   * work, so the back button rewinds the experience.
   */
  bindHashNavigation(onChapter: (id: string) => void) {
    const resolve = (): boolean => {
      const id = window.location.hash.replace('#', '')
      if (!id) return false
      if (id === 'specifications' || id === 'reserve') {
        const doc = document.documentElement
        const bottom = Math.max(0, doc.scrollHeight - window.innerHeight)
        if (this.lenis && !this.reducedMotion) {
          this.lenis.stop()
          this.lenis.scrollTo(bottom, {
            duration: 1.4,
            force: true,
            lock: true,
            onComplete: () => this.lenis?.start(),
          })
        } else {
          window.scrollTo({ top: bottom, behavior: 'auto' })
        }
        return true
      }
      onChapter(id)
      return true
    }

    const handler = () => {
      resolve()
    }
    window.addEventListener('hashchange', handler)
    this.hashCleanup = () => window.removeEventListener('hashchange', handler)
    // Honour the hash the page was loaded with, once the track has measured.
    if (window.location.hash) window.setTimeout(handler, 120)
  }

  private hashCleanup: (() => void) | null = null

  subscribe(fn: (p: number) => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  onResize(fn: () => void) {
    this.resizeListeners.add(fn)
    return () => this.resizeListeners.delete(fn)
  }

  /** Emit coarse progress events (chapter boundaries) — used by the HUD. */
  emitCoarse() {
    const p = Math.round(this.progress * 1000) / 1000
    for (const l of this.listeners) l(p)
  }

  dispose() {
    this.hashCleanup?.()
    cancelAnimationFrame(this.rafId)
    window.removeEventListener('resize', this.handleResize)
    window.removeEventListener('orientationchange', this.handleResize)
    this.lenis?.destroy()
    this.lenis = null
  }
}

export const scrollStore = new ScrollStore()

/** Smootherstep-shaped chapter progress: 0 before, 1 after, eased between. */
export const localProgress = (p: number, start: number, end: number) =>
  smootherstep(start, end, p)
