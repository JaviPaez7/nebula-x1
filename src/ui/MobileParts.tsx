import { useEffect, useRef } from 'react'
import { at } from '../core/chapters'
import { smoothstep } from '../core/math'
import { PART_LABELS } from '../core/experience'
import { scrollStore } from '../core/scrollStore'

/**
 * Phone presentation of the exploded view.
 *
 * A callout layer with eleven leader lines needs horizontal room that a phone
 * does not have, so on narrow screens the annotations become a compact parts
 * list instead — the same information, legible, without crowding the machine
 * off the screen. It is driven by the same scroll progress as everything else.
 */
export function MobileParts() {
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = root.current
    if (!el) return
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const p = scrollStore.smooth
      const present =
        smoothstep(at('exploded', 0.4), at('exploded', 0.66), p) *
        (1 - smoothstep(at('aerodynamics', 0.24), at('aerodynamics', 0.6), p))
      el.style.opacity = present.toFixed(3)
      el.style.visibility = present > 0.02 ? 'visible' : 'hidden'
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="mobile-parts" ref={root} aria-hidden="true">
      {PART_LABELS.map((l, i) => (
        <span key={i} className="mp-item">
          <b>{String(i + 1).padStart(2, '0')}</b>
          {l.label}
        </span>
      ))}
    </div>
  )
}
