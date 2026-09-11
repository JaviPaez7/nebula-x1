import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { at } from '../core/chapters'
import { clamp, smoothstep } from '../core/math'
import { anchorWorld, PART_LABELS } from '../core/experience'
import { scrollStore } from '../core/scrollStore'
import { PART_COUNT } from '../three/bikeParts'

/**
 * Exploded-view annotations.
 *
 * Anchors live in the machine's coordinate space and are projected through the
 * live camera every frame, so the callouts stay welded to hardware that is
 * still moving. A greedy lane pass keeps labels from stacking, and each card
 * gets its own leader line back to the exact point on the part.
 */
export function Callouts({ camera }: { camera: THREE.Camera }): JSX.Element {
  const layer = useRef<HTMLDivElement>(null)
  const nodes = useMemo(() => new Array<HTMLElement | null>(PART_COUNT).fill(null), [])
  const v = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    const root = layer.current
    if (!root) return
    let raf = 0

    const tick = () => {
      raf = requestAnimationFrame(tick)
      const width = root.clientWidth
      const height = root.clientHeight
      if (!width || !height) return

      const p = scrollStore.smooth
      const present =
        smoothstep(at('exploded', 0.36), at('exploded', 0.66), p) *
        (1 - smoothstep(at('aerodynamics', 0.22), at('aerodynamics', 0.62), p))

      root.style.opacity = present.toFixed(3)
      root.style.visibility = present > 0.015 ? 'visible' : 'hidden'
      if (present <= 0.015) return

      const proj: { i: number; x: number; y: number; vis: boolean }[] = []

      for (let i = 0; i < PART_COUNT; i++) {
        anchorWorld(i, v)
        v.project(camera)
        proj.push({
          i,
          x: (v.x * 0.5 + 0.5) * width,
          y: (-v.y * 0.5 + 0.5) * height,
          vis: v.z <= 1 && Math.abs(v.x) < 1.5 && Math.abs(v.y) < 1.5,
        })
      }
      proj.sort((a, b) => a.y - b.y)

      // Lay the cards out side by side with a guaranteed gap, then pull the
      // whole stack back toward the anchors so no leader line gets absurdly
      // long. Two passes: push down to clear collisions, then shift the stack
      // up by half the overflow. Sorting guarantees each side is in y order.
      const GAP = 64
      const stackYOf = new Array<number>(PART_COUNT).fill(0)
      for (const side of ['left', 'right'] as const) {
        const items = proj.filter((p) => p.vis && PART_LABELS[p.i].side === side)
        if (items.length === 0) continue
        const ys = items.map((p) => p.y)
        for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i], ys[i - 1] + GAP)
        const overflow = ys[ys.length - 1] - items[items.length - 1].y
        const shift = Math.max(0, overflow) / 2
        for (let i = 0; i < items.length; i++) stackYOf[items[i].i] = ys[i] - shift
      }

      for (const item of proj) {
        const el = nodes[item.i]
        if (!el) continue
        if (!item.vis) {
          el.style.opacity = '0'
          continue
        }
        const side = PART_LABELS[item.i].side
        const stackY = stackYOf[item.i]

        // The leader grows to reach the card but is capped so the anchor and
        // its label always read as a pair.
        const gap = clamp(Math.abs(stackY - item.y) + 44, 46, 138)
        const cardW = 188
        const dir = side === 'left' ? -1 : 1

        el.style.transform = `translate3d(${item.x.toFixed(1)}px, ${item.y.toFixed(1)}px, 0)`
        const edge = clamp(Math.min(item.x, width - item.x) / 90)
        el.style.opacity = (present * edge).toFixed(3)
        el.style.zIndex = String(2000 - Math.round(Math.abs(stackY - item.y)))

        const dot = el.querySelector('.co-dot') as HTMLElement | null
        if (dot) dot.style.transform = `translate(-50%, -50%) translateX(${(dir * 12).toFixed(0)}px)`
        const lead = el.querySelector('.co-lead') as SVGSVGElement | null
        if (lead) {
          lead.setAttribute('width', gap.toFixed(0))
          lead.style.left = `${(dir < 0 ? -gap - 12 : 12).toFixed(0)}px`
        }
        const card = el.querySelector('.co-card') as HTMLElement | null
        if (card) {
          card.style.left = `${(dir < 0 ? -gap - 12 - cardW : 12).toFixed(0)}px`
          card.style.top = `${(stackY - item.y - 6).toFixed(1)}px`
          card.style.width = `${cardW}px`
          card.style.textAlign = dir < 0 ? 'right' : 'left'
        }
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [camera, nodes, v])

  return (
    <div className="callout-layer" ref={layer}>
      {PART_LABELS.map((l, i) => (
        <div key={i} className="callout" ref={(el) => void (nodes[i] = el)}>
          <svg className="co-lead" width="90" height="1" aria-hidden="true">
            <line x1="0" y1="0.5" x2="100%" y2="0.5" />
          </svg>
          <span className="co-dot" />
          <div className="co-card">
            <div className="n">{String(i + 1).padStart(2, '0')}</div>
            <div className="l">{l.label}</div>
            <div className="m">{l.meta}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
