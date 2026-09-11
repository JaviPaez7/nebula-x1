import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CHAPTERS, RANGES } from '../core/chapters'
import { onDomTick } from '../core/domSignals'
import { clamp, pad, smoothstep } from '../core/math'
import { scrollStore } from '../core/scrollStore'
import { at } from '../core/chapters'

/* ------------------------------------------------------------- chrome */

/**
 * The frame around the film: wordmark, timecode, chapter rail and the
 * progress hairline. Active-chapter state is the only thing React re-renders,
 * and only when the chapter actually changes.
 */
export function Chrome() {
  const [active, setActive] = useState(0)

  const navRef = useRef<(i: number) => void>(() => undefined)
  const progressFill = useRef<HTMLSpanElement>(null)
  const tc = useRef<HTMLSpanElement>(null)
  const pct = useRef<HTMLSpanElement>(null)
  const scrollHint = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    let lastChapter = -1
    return onDomTick((s) => {
      const p = s.progress
      if (progressFill.current) progressFill.current.style.transform = `scaleX(${p.toFixed(4)})`
      if (tc.current) {
        const frames = Math.floor((s.elapsed * 24) % 24)
        const secs = Math.floor(p * 168)
        tc.current.textContent = `TC ${pad(Math.floor(secs / 60))}:${pad(secs % 60)}:${pad(frames)}`
      }
      if (pct.current) pct.current.textContent = `${pad(p * 100, 3)}`

      let idx = 0
      for (let i = 0; i < RANGES.length; i++) if (p >= RANGES[i].start) idx = i
      if (idx !== lastChapter) {
        lastChapter = idx
        setActive(idx)
      }

      const h = 1 - smoothstep(0, at('introduction', 0.5), p)
      if (scrollHint.current) scrollHint.current.style.setProperty('--hint', h.toFixed(3))
    })
  }, [])

  useEffect(() => {
    const goToChapter = (i: number) => {
      const r = RANGES[i]
      if (!r) return
      // Land a little way in, so the chapter's first beat is already live, but
      // not so far that the chapter is nearly over before the user looks up.
      const target = r.start + (r.end - r.start) * 0.06
      const distance = Math.abs(target - scrollStore.measureRanges().progress)
      scrollStore.scrollToProgressTimed(target, 0.75 + Math.min(1.3, distance * 2.4))
    }
    scrollStore.bindHashNavigation((id) => {
      const i = RANGES.findIndex((c) => c.id === id)
      if (i >= 0) goToChapter(i)
    })
    navRef.current = goToChapter
  }, [])

  return (
    <>
      <div className="chrome-tl">
        <div className="chrome-wordmark">
          <i />
          <span>Nebula X1</span>
        </div>
      </div>

      <div className="chrome-tr">
        <span ref={tc}>TC 00:00:00</span>
        <br />
        <span style={{ opacity: 0.7 }}>Scroll-driven · WebGL</span>
      </div>

      <div className="chrome-bl">
        <span>Electric hyperbike · 2027</span>
      </div>

      <div className="chrome-br">
        <span>
          <span ref={pct}>000</span> / 100
        </span>
      </div>

      <nav className="chapter-nav" aria-label="Chapters">
        {CHAPTERS.map((c, i) => (
          <button
            key={c.id}
            type="button"
            onClick={() => navRef.current(i)}
            data-active={i === active}
            data-past={i < active}
            aria-current={i === active ? 'true' : undefined}
          >
            <span className="nav-label">
              {c.index} {c.label}
            </span>
            <span className="nav-tick" />
          </button>
        ))}
      </nav>

      <div className="progress-bar" aria-hidden="true">
        <span ref={progressFill} style={{ transformOrigin: 'left center' }} />
      </div>

      <div className="scroll-hint" ref={scrollHint} aria-hidden="true">
        <span className="t-label">Scroll</span>
        <span className="line" />
      </div>
    </>
  )
}

/* ------------------------------------------------------------ telemetry */

/**
 * Live machine telemetry. Values are computed from scroll progress in the
 * telemetry's own frame loop and written straight to the DOM, so this panel
 * costs nothing in React terms.
 */
export function Telemetry() {
  const root = useRef<HTMLDivElement>(null)
  const out = useRef<HTMLSpanElement>(null)
  const temp = useRef<HTMLSpanElement>(null)
  const regen = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    let lastOut = -1
    let lastTemp = -1
    return onDomTick((s) => {
      const p = s.progress
      const load = smoothstep(at('performance', 0.2), at('ride', 0.7), p)
      const release = 1 - smoothstep(at('finale', 0.1), at('finale', 0.5), p)
      const drive = load * release
      const kw = Math.round(drive * 165 + (1 - drive) * 0.02 * 165)
      const c = Math.round(21 + drive * 46)
      const reg = Math.round(clamp(0.15 + drive * 0.85) * 60)

      if (kw !== lastOut) {
        lastOut = kw
        if (out.current) out.current.textContent = `${kw} kW`
      }
      if (c !== lastTemp) {
        lastTemp = c
        if (temp.current) temp.current.textContent = `${c} °C`
      }
      if (regen.current) regen.current.textContent = `${reg} kW`
      if (root.current) {
        const vis = smoothstep(at('performance', 0.12), at('performance', 0.5), p) * release
        root.current.style.opacity = vis.toFixed(3)
        root.current.style.visibility = vis > 0.02 ? 'visible' : 'hidden'
      }
    })
  }, [])

  return (
    <div className="telemetry" ref={root}>
      <div className="row">
        <span>Output</span>
        <span ref={out}>0 kW</span>
      </div>
      <div className="row">
        <span>Stator temp</span>
        <span ref={temp}>21 °C</span>
      </div>
      <div className="row">
        <span>Regeneration</span>
        <span ref={regen}>9 kW</span>
      </div>
      <div className="row">
        <span>System</span>
        <span>800 V · 4.1 kWh/100km</span>
      </div>
    </div>
  )
}
