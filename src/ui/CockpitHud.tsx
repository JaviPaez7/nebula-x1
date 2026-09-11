import { useLayoutEffect, useRef, type JSX } from 'react'
import { at } from '../core/chapters'
import { onDomTick } from '../core/domSignals'
import { clamp, smoothstep } from '../core/math'

/**
 * The instrument cluster.
 *
 * This is not a static mock-up: every value is driven by scroll progress, so
 * the rider's view accelerates, the state of charge falls, the temperature
 * climbs and the navigation guidance counts down as the film advances — and
 * runs backwards when the user scrolls up.
 */
export function CockpitHud() {
  const root = useRef<HTMLDivElement>(null)
  const speed = useRef<HTMLSpanElement>(null)
  const speedBar = useRef<HTMLSpanElement>(null)
  const soc = useRef<HTMLSpanElement>(null)
  const socBar = useRef<HTMLSpanElement>(null)
  const power = useRef<HTMLSpanElement>(null)
  const powerBar = useRef<HTMLSpanElement>(null)
  const temp = useRef<HTMLSpanElement>(null)
  const range = useRef<HTMLSpanElement>(null)
  const time = useRef<HTMLSpanElement>(null)
  const dist = useRef<HTMLSpanElement>(null)
  const distBar = useRef<HTMLSpanElement>(null)
  const odo = useRef<HTMLSpanElement>(null)
  const trace = useRef<SVGPolylineElement>(null)
  const gforce = useRef<HTMLSpanElement>(null)
  const modeRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = root.current
    if (!el) return

    let lastSpeed = -1
    let lastSoc = -1

    return onDomTick((s) => {
      const p = s.progress
      // Interface presence: fades in with the cockpit chapter and stays
      // available through the ride, then hands over to the finale.
      const inv = smoothstep(at('cockpit', 0.14), at('cockpit', 0.36), p)
      const outv = 1 - smoothstep(at('finale', 0.06), at('finale', 0.3), p)
      const vis = inv * outv
      el.style.setProperty('--c', vis.toFixed(4))
      el.style.setProperty('--cvis', vis > 0.01 ? 'visible' : 'hidden')

      /* ---- ride dynamics ---- */
      // The ride accelerates through chapter 11 and settles for the finale.
      const rideAccel = smoothstep(at('ride', 0.1), at('ride', 0.72), p)
      const rollOff = smoothstep(at('ride', 0.86), at('finale', 0.24), p)
      const v = rideAccel * (1 - rollOff)
      const kmh = Math.round(v * 187)

      const powerKw = Math.round(
        (0.42 * smoothstep(at('cockpit', 0.4), at('cockpit', 0.8), p) + 1.05 * clamp(v * 1.35)) * 158,
      )
      const socPct = 92 - Math.round(v * 11 + smoothstep(at('cockpit', 0.2), at('ride', 0.8), p) * 8)
      const tempC = 34 + Math.round(smoothstep(at('cockpit', 0.3), at('ride', 0.6), p) * 27 + v * 9)
      const rangeKm = Math.round(214 - v * 96 - smoothstep(at('cockpit', 0.2), at('ride', 0.8), p) * 12)
      const gForce = (0.0 + v * 1.42 + smoothstep(at('ride', 0.2), at('ride', 0.5), p) * 0.3).toFixed(2)
      const distanceM = Math.max(0, Math.round(420 - smoothstep(at('ride', 0.02), at('ride', 0.95), p) * 380))
      const clock = 14 * 60 + 32 + Math.round(smoothstep(at('cockpit', 0.1), at('ride', 1.0), p) * 21)
      const clockStr = `${String(Math.floor(clock / 60) % 24).padStart(2, '0')}:${String(clock % 60).padStart(2, '0')}`

      if (kmh !== lastSpeed) {
        lastSpeed = kmh
        if (speed.current) speed.current.textContent = String(kmh).padStart(3, '0')
      }
      if (socPct !== lastSoc) {
        lastSoc = socPct
        if (soc.current) soc.current.textContent = `${socPct}%`
      }
      if (speedBar.current) speedBar.current.style.transform = `scaleX(${clamp(v * 1.05).toFixed(3)})`
      if (socBar.current) socBar.current.style.transform = `scaleX(${(socPct / 100).toFixed(3)})`
      if (powerBar.current) powerBar.current.style.transform = `scaleX(${clamp(powerKw / 165).toFixed(3)})`
      if (power.current) power.current.textContent = `${powerKw}`
      if (temp.current) temp.current.textContent = `${tempC}°`
      if (range.current) range.current.textContent = `${rangeKm}`
      if (time.current) time.current.textContent = clockStr
      if (dist.current) dist.current.textContent = distanceM >= 1000 ? `${(distanceM / 1000).toFixed(1)} km` : `${distanceM} m`
      if (distBar.current) distBar.current.style.transform = `scaleX(${clamp(1 - distanceM / 420).toFixed(3)})`
      if (gforce.current) gforce.current.textContent = `${gForce} g`
      if (odo.current) odo.current.textContent = `${(12480 + Math.round(smoothstep(at('cockpit', 0.1), at('ride', 1), p) * 37)).toLocaleString('en-US')} km`

      if (modeRef.current) {
        const mode = v > 0.72 ? 'TRACK' : v > 0.2 ? 'SPORT' : 'CITY'
        if (modeRef.current.dataset.mode !== mode) modeRef.current.dataset.mode = mode
      }

      // Live power trace: a rolling polyline, amplitude driven by throttle.
      if (trace.current) {
        const pts: string[] = []
        const n = 40
        for (let i = 0; i < n; i++) {
          const x = (i / (n - 1)) * 240
          const phase = s.elapsed * 2.6 + i * 0.42
          const amp = (0.18 + v * 0.82) * (0.5 + 0.5 * Math.sin(i * 0.28 + s.elapsed * 0.8))
          const y = 30 - (Math.sin(phase) * 0.5 + 0.5) * 26 * amp - 4
          pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
        }
        trace.current.setAttribute('points', pts.join(' '))
      }
    })
  }, [])

  return (
    <div className="cockpit-hud" ref={root}>
      <div className="chud">
        <div className="chud-top">
          <div className="chud-mode" ref={modeRef} data-mode="CITY">
            <span className="dot" />
            <span className="txt">City</span>
          </div>
          <div className="chud-time">
            <span ref={time}>14:32</span>
            <em>Ride 04 · Est. 41 min</em>
          </div>
        </div>

        <div className="chud-mid">
          <div className="chud-speed">
            <span className="chud-speed-num" ref={speed}>
              000
            </span>
            <span className="chud-speed-unit">km/h</span>
            <span className="chud-speed-bar">
              <i ref={speedBar} />
            </span>
          </div>
          <div className="chud-side">
            <div className="chud-cell">
              <span className="k">Power</span>
              <span className="v">
                <b ref={power}>0</b> kW
              </span>
              <span className="bar">
                <i ref={powerBar} />
              </span>
            </div>
            <div className="chud-cell">
              <span className="k">Battery</span>
              <span className="v">
                <b ref={soc}>92%</b>
              </span>
              <span className="bar">
                <i ref={socBar} />
              </span>
            </div>
          </div>
        </div>

        <div className="chud-bottom">
          <div className="chud-trace">
            <span className="k">Delivery</span>
            <svg viewBox="0 0 240 34" preserveAspectRatio="none" aria-hidden="true">
              <polyline ref={trace} points="" />
            </svg>
          </div>
          <div className="chud-stats">
            <div>
              <span className="k">Temp</span>
              <span className="v" ref={temp}>
                34°
              </span>
            </div>
            <div>
              <span className="k">Range</span>
              <span className="v">
                <b ref={range}>214</b> km
              </span>
            </div>
            <div>
              <span className="k">G</span>
              <span className="v" ref={gforce}>
                0.00 g
              </span>
            </div>
            <div>
              <span className="k">Odo</span>
              <span className="v" ref={odo}>
                12,480 km
              </span>
            </div>
          </div>
        </div>

        <div className="chud-nav">
          <div className="chud-nav-head">
            <span className="k">Next</span>
            <span className="v">Autodromo · Sector 3</span>
          </div>
          <div className="chud-nav-body">
            <div className="chud-nav-arrow" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M12 2 L20 13 H15.5 V22 H8.5 V13 H4 Z" />
              </svg>
            </div>
            <div className="chud-nav-figures">
              <span className="d" ref={dist}>
                420 m
              </span>
              <span className="bar">
                <i ref={distBar} />
              </span>
            </div>
          </div>
        </div>

        <div className="chud-warn">
          <span>TC 2</span>
          <span>ABS 1</span>
          <span>REGEN 3</span>
          <span className="live">LIVE</span>
        </div>
      </div>
    </div>
  )
}

/* --------------------------------------------------------- exploded labels */

/**
 * An exploded-view annotation. The director projects the part's anchor into
 * screen space; this component draws the leader line and the card. Because the
 * projection happens every frame, the labels track the hardware exactly while
 * the parts are still moving.
 */
export function Callout({
  index,
  label,
  meta,
  side,
}: {
  index: number
  label: string
  meta: string
  side: 'left' | 'right'
}): JSX.Element {
  return (
    <div className="callout" data-callout={index}>
      <svg className="co-lead" width="120" height="1" aria-hidden="true">
        <line x1="0" y1="0.5" x2="120" y2="0.5" />
      </svg>
      <span className="co-dot" />
      <div className="co-card" data-side={side}>
        <div className="n">{String(index + 1).padStart(2, '0')}</div>
        <div className="l">{label}</div>
        <div className="m">{meta}</div>
      </div>
    </div>
  )
}
