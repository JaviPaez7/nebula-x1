import { useEffect, useRef, useState } from 'react'
import { loadManager } from '../core/loadManager'

/**
 * The curtain.
 *
 * Progress here is real: the loader only advances when a genuine unit of boot
 * work reports in — texture synthesis, material compilation, particle field
 * construction, the first compiled frame. It never counts up on a timer, and
 * it never lifts before the machine is actually ready to be drawn.
 */
export function Loader({ done, onEnter }: { done: boolean; onEnter: () => void }) {
  const [pct, setPct] = useState(0)
  const [label, setLabel] = useState('Initialising')
  const bar = useRef<HTMLSpanElement>(null)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    let raf = 0
    let shown = 0
    const unsub = loadManager.subscribe((p, l) => {
      setLabel(l)
      const step = () => {
        // Ease the displayed value toward the real one so the bar never jumps.
        shown += (p - shown) * 0.16
        if (Math.abs(p - shown) < 0.002) shown = p
        setPct(shown)
        if (bar.current) bar.current.style.width = `${(shown * 100).toFixed(1)}%`
        if (Math.abs(p - shown) > 0.002) raf = requestAnimationFrame(step)
      }
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(step)
    })
    return () => {
      unsub()
      cancelAnimationFrame(raf)
    }
  }, [])

  useEffect(() => {
    if (!done) return
    const id = window.setTimeout(() => setHidden(true), 1500)
    return () => window.clearTimeout(id)
  }, [done])

  if (hidden) return null

  return (
    <div className="loader" data-done={done} role="status" aria-live="polite">
      <div className="loader-top">
        <span>Nebula X1</span>
        <span>Milan · MMXXVII</span>
      </div>
      <div className="loader-mid">
        <div
          className="brand-mark"
          style={{ fontSize: 'clamp(30px, 5vw, 64px)', letterSpacing: '-0.03em' }}
        >
          Nebula
          <span className="x1" style={{ fontSize: '0.5em' }}>
            X1
          </span>
        </div>
        <div className="loader-bar">
          <span ref={bar} />
        </div>
        <div className="loader-pct">{String(Math.round(pct * 100)).padStart(3, '0')}</div>
        <div className="loader-label">{done ? 'Ready' : label}</div>
        {done && (
          <button type="button" className="btn" onClick={onEnter} style={{ marginTop: 8 }}>
            Enter
          </button>
        )}
      </div>
      <div className="loader-bottom">
        <span>Electric hyperbike</span>
        <span>165 kW · 310 Nm</span>
      </div>
    </div>
  )
}
