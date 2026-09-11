import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { at } from '../core/chapters'
import { onDomTick } from '../core/domSignals'
import { applyScrub, resolve, envelope } from '../core/timeline'

type Pos =
  | 'left'
  | 'left-high'
  | 'left-low'
  | 'right'
  | 'right-low'
  | 'center'
  | 'center-low'
  | 'finale-top'
  | 'finale-bottom'

export type Caption = {
  id: string
  pos: Pos
  /** timecode, or a timing descriptor for a longer hold */
  t: number | { at: number; rise?: number; fall?: number }
  /** travel distance in px for the exit motion */
  d?: number
  blur?: number
  className?: string
  node: ReactNode
}

const cls = (pos: Pos) => `cap cap--${pos}`

/**
 * The caption rail.
 *
 * All of the film's typography lives here as one absolutely-positioned layer.
 * Each block is driven straight from scroll progress, so text arrives with the
 * shot it belongs to and leaves with it — including when the user scrolls
 * backwards through the middle of a sentence.
 */
export function Captions({ captions }: { captions: Caption[] }) {
  const nodes = useRef<(HTMLDivElement | null)[]>([])

  useLayoutEffect(() => {
    if (nodes.current.length === 0) return
    const els = nodes.current.slice()
    return onDomTick((s) => {
      const p = s.progress
      for (let i = 0; i < els.length; i++) {
        const el = els[i]
        if (!el) continue
        const c = captions[i]
        applyScrub(el, p, c.t, {
          distance: c.d ?? 26,
          blur: c.blur ?? 7,
          span: typeof c.t === 'number' ? 0.014 : (c.t.rise ?? 0.02),
        })
      }
    })
  }, [captions])

  return (
    <div className="captions" aria-hidden="true">
      {captions.map((c, i) => (
        <div
          key={c.id}
          ref={(el) => void (nodes.current[i] = el)}
          className={`${cls(c.pos)}${c.className ? ` ${c.className}` : ''}`}
          data-caption={c.id}
        >
          <div className="cap-inner">{c.node}</div>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------- fragments */

export function Kicker({ children }: { children: ReactNode }) {
  return <div className="t-kicker">{children}</div>
}

export function Rule() {
  return <hr className="rule" style={{ margin: '18px 0' }} />
}

/** A measured readout: mono value with a hairline label under it. */
export function Metric({
  value,
  unit,
  label,
}: {
  value: ReactNode
  unit?: string
  label: string
}) {
  return (
    <div className="metric">
      <div className="metric-value t-readout">
        {value}
        {unit ? <em>{unit}</em> : null}
      </div>
      <div className="t-label metric-label">{label}</div>
    </div>
  )
}

export function MetricRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`metric-row${className ? ` ${className}` : ''}`}>{children}</div>
}

/* -------------------------------------------------- the caption manifest */

export const CAPTIONS: Caption[] = [
  /* ── 01 · Introduction ───────────────────────────────────────────────── */
  {
    id: 'intro-title',
    pos: 'left-high',
    className: 'intro-title',
    t: { at: at('introduction', 0.3), rise: 0.02, fall: 0.022 },
    d: 40,
    node: (
      <>
        <h1 className="t-display brand-mark" style={{ fontSize: 'clamp(58px, 11vw, 186px)' }}>
          Nebula
          <span className="x1">X1</span>
        </h1>
      </>
    ),
  },
  {
    id: 'intro-tagline',
    pos: 'left-low',
    t: { at: at('introduction', 0.66), rise: 0.022, fall: 0.02 },
    d: 22,
    node: (
      <p className="t-sub" style={{ fontSize: 'clamp(15px, 1.5vw, 21px)', letterSpacing: '0.01em' }}>
        Electricity, weaponized.
      </p>
    ),
  },
  {
    id: 'intro-meta',
    pos: 'left-low',
    className: 'intro-meta',
    t: { at: at('introduction', 0.88), rise: 0.016, fall: 0.014 },
    d: 16,
    node: (
      <div style={{ display: 'flex', gap: 'clamp(20px, 4vw, 54px)', flexWrap: 'wrap' }}>
        <span className="t-label">Series production · 2027</span>
        <span className="t-label">Milan · Barcelona · Tokyo</span>
        <span className="t-label">Scroll to begin</span>
      </div>
    ),
  },

  /* ── 02 · Reveal ─────────────────────────────────────────────────────── */
  {
    id: 'reveal-kicker',
    pos: 'left-high',
    t: { at: at('reveal', 0.16), rise: 0.016, fall: 0.02 },
    d: 18,
    node: <Kicker>Chapter 02 — The reveal</Kicker>,
  },
  {
    id: 'reveal-1',
    pos: 'left',
    t: { at: at('reveal', 0.34), rise: 0.014, fall: 0.016 },
    d: 24,
    node: (
      <p className="t-sub" style={{ fontSize: 'clamp(15px, 1.35vw, 19px)', maxWidth: '34ch' }}>
        Sixty-eight separate forgings, castings and laminates. One silhouette.
      </p>
    ),
  },
  {
    id: 'reveal-2',
    pos: 'right',
    t: { at: at('reveal', 0.6), rise: 0.014, fall: 0.016 },
    d: 26,
    node: (
      <>
        <Kicker>Front assembly</Kicker>
        <p className="t-display" style={{ fontSize: 'clamp(26px, 3.1vw, 46px)', margin: '12px 0 10px' }}>
          48 mm
          <br />
          Titanium nitride
        </p>
        <p className="t-sub" style={{ fontSize: '14px' }}>
          Fully adjustable, radially mounted, 1.9 kg per leg.
        </p>
      </>
    ),
  },
  {
    id: 'reveal-3',
    pos: 'left-low',
    t: { at: at('reveal', 0.86), rise: 0.014, fall: 0.016 },
    d: 22,
    node: (
      <div style={{ display: 'flex', gap: 'clamp(18px, 3vw, 44px)', alignItems: 'flex-end' }}>
        <Metric value="1 380" unit="mm" label="Wheelbase" />
        <Metric value="842" unit="mm" label="Seat height" />
        <Metric value="208" unit="kg" label="Ready to ride" />
      </div>
    ),
  },

  /* ── 03 · Performance ────────────────────────────────────────────────── */
  {
    id: 'perf-kicker',
    pos: 'left-high',
    t: { at: at('performance', 0.1), rise: 0.014, fall: 0.016 },
    d: 16,
    node: <Kicker>Chapter 03 — Performance</Kicker>,
  },
  {
    id: 'perf-main',
    pos: 'left',
    t: { at: at('performance', 0.28), rise: 0.016, fall: 0.018 },
    d: 30,
    node: (
      <>
        <div className="t-readout" style={{ fontSize: 'clamp(76px, 11vw, 190px)' }}>
          2.4
          <em style={{ fontSize: '0.22em', letterSpacing: '0.06em', marginLeft: '0.28em', fontStyle: 'normal', color: 'var(--volt)' }}>
            SEC
          </em>
        </div>
        <div style={{ marginTop: '18px' }}>
          <Kicker>0 – 100 km/h</Kicker>
        </div>
        <p className="t-sub" style={{ fontSize: '14px', marginTop: '14px', maxWidth: '30ch' }}>
          Traction-limited, not power-limited. The front wheel stays down because
          the software says so.
        </p>
      </>
    ),
  },
  {
    id: 'perf-right',
    pos: 'right',
    t: { at: at('performance', 0.54), rise: 0.014, fall: 0.016 },
    d: 24,
    node: (
      <div style={{ display: 'grid', gap: '26px', justifyItems: 'end' }}>
        <Metric value="165" unit="kW" label="Peak power" />
        <Metric value="310" unit="Nm" label="Torque, from zero rpm" />
      </div>
    ),
  },
  {
    id: 'perf-low',
    pos: 'left-low',
    t: { at: at('performance', 0.78), rise: 0.014, fall: 0.016 },
    d: 20,
    node: (
      <div style={{ display: 'flex', gap: 'clamp(18px, 3vw, 44px)', alignItems: 'flex-end' }}>
        <Metric value="285" unit="km/h" label="Top speed" />
        <Metric value="11 200" unit="rpm" label="Drive limit" />
        <Metric value="1 : 8.4" label="Reduction" />
      </div>
    ),
  },

  /* ── 04 · Composition ────────────────────────────────────────────────── */
  {
    id: 'expl-kicker',
    pos: 'left-high',
    t: { at: at('exploded', 0.16), rise: 0.014, fall: 0.018 },
    d: 16,
    node: <Kicker>Chapter 04 — Composition</Kicker>,
  },
  {
    id: 'expl-title',
    pos: 'left',
    t: { at: at('exploded', 0.34), rise: 0.016, fall: 0.02 },
    d: 28,
    node: (
      <>
        <p className="t-display" style={{ fontSize: 'clamp(30px, 4vw, 62px)' }}>
          Eleven systems.
          <br />
          One machine.
        </p>
        <p className="t-sub" style={{ fontSize: '14px', marginTop: '16px', maxWidth: '33ch' }}>
          1 847 components resolve into eleven serviceable assemblies in under
          four hours.
        </p>
      </>
    ),
  },
  {
    id: 'expl-note',
    pos: 'right-low',
    t: { at: at('exploded', 0.72), rise: 0.016, fall: 0.02 },
    d: 24,
    node: (
      <>
        <Kicker>Service architecture</Kicker>
        <p className="t-sub" style={{ fontSize: '14px', marginTop: '12px', maxWidth: '30ch' }}>
          The pack, the drive unit and the front assembly are all single-module
          swaps. Nothing is glued shut.
        </p>
      </>
    ),
  },

  /* ── 05 · Energy ─────────────────────────────────────────────────────── */
  {
    id: 'bat-kicker',
    pos: 'left-high',
    t: { at: at('battery', 0.1), rise: 0.014, fall: 0.016 },
    d: 16,
    node: <Kicker>Chapter 05 — Energy</Kicker>,
  },
  {
    id: 'bat-main',
    pos: 'left',
    t: { at: at('battery', 0.3), rise: 0.016, fall: 0.018 },
    d: 26,
    node: (
      <>
        <div className="t-readout" style={{ fontSize: 'clamp(58px, 8.6vw, 148px)' }}>
          120<em style={{ fontSize: '0.2em', letterSpacing: '0.05em', marginLeft: '0.3em', fontStyle: 'normal', color: 'var(--volt)' }}>kWh</em>
        </div>
        <div style={{ marginTop: '14px' }}>
          <Kicker>Equivalent architecture</Kicker>
        </div>
      </>
    ),
  },
  {
    id: 'bat-right',
    pos: 'right',
    t: { at: at('battery', 0.56), rise: 0.014, fall: 0.016 },
    d: 22,
    node: (
      <div style={{ display: 'grid', gap: '24px', justifyItems: 'end' }}>
        <Metric value="800" unit="V" label="Nominal system" />
        <Metric value="10 – 80" unit="%" label="Charge window" />
        <Metric value="14" unit="min" label="At 350 kW" />
      </div>
    ),
  },
  {
    id: 'bat-low',
    pos: 'left-low',
    t: { at: at('battery', 0.8), rise: 0.014, fall: 0.018 },
    d: 20,
    node: (
      <p className="t-sub" style={{ fontSize: '14px', maxWidth: '40ch' }}>
        The enclosure is a structural member. It carries torsional load, acts as
        a heat sink, and is pressure-tested to IP68.
      </p>
    ),
  },

  /* ── 06 · Drive ──────────────────────────────────────────────────────── */
  {
    id: 'mot-kicker',
    pos: 'left-high',
    t: { at: at('motor', 0.12), rise: 0.014, fall: 0.016 },
    d: 16,
    node: <Kicker>Chapter 06 — Drive unit</Kicker>,
  },
  {
    id: 'mot-main',
    pos: 'left',
    t: { at: at('motor', 0.34), rise: 0.016, fall: 0.018 },
    d: 26,
    node: (
      <>
        <p className="t-display" style={{ fontSize: 'clamp(30px, 4vw, 60px)' }}>
          Full torque
          <br />
          at zero rpm.
        </p>
        <p className="t-sub" style={{ fontSize: '14px', marginTop: '16px', maxWidth: '32ch' }}>
          310 Nm from the first millisecond — the reason the front wheel needs
          managing and the tyres need warming.
        </p>
      </>
    ),
  },
  {
    id: 'mot-right',
    pos: 'right',
    t: { at: at('motor', 0.6), rise: 0.014, fall: 0.016 },
    d: 22,
    node: (
      <div style={{ display: 'grid', gap: '22px', justifyItems: 'end' }}>
        <Metric value="96.4" unit="%" label="Peak efficiency" />
        <Metric value="18 000" unit="rpm" label="Rotor limit" />
        <Metric value="9" unit="kg" label="Oil-cooled stator" />
      </div>
    ),
  },
  {
    id: 'mot-low',
    pos: 'left-low',
    t: { at: at('motor', 0.82), rise: 0.014, fall: 0.016 },
    d: 18,
    node: <span className="t-label">Direct-oil cooling · no reduction losses above 40 km/h</span>,
  },

  /* ── 07 · Airflow ────────────────────────────────────────────────────── */
  {
    id: 'aero-kicker',
    pos: 'left-high',
    t: { at: at('aerodynamics', 0.14), rise: 0.014, fall: 0.016 },
    d: 16,
    node: <Kicker>Chapter 07 — Airflow</Kicker>,
  },
  {
    id: 'aero-main',
    pos: 'left',
    t: { at: at('aerodynamics', 0.36), rise: 0.016, fall: 0.018 },
    d: 26,
    node: (
      <>
        <div className="t-readout" style={{ fontSize: 'clamp(50px, 7.4vw, 120px)' }}>
          0.28<em style={{ fontSize: '0.24em', letterSpacing: '0.05em', marginLeft: '0.3em', fontStyle: 'normal', color: 'var(--volt)' }}>Cd</em>
        </div>
        <div style={{ marginTop: '14px' }}>
          <Kicker>With rider, at 200 km/h</Kicker>
        </div>
      </>
    ),
  },
  {
    id: 'aero-right',
    pos: 'right',
    t: { at: at('aerodynamics', 0.62), rise: 0.014, fall: 0.016 },
    d: 22,
    node: (
      <div style={{ display: 'grid', gap: '22px', justifyItems: 'end' }}>
        <Metric value="+14" unit="kg" label="Downforce at 180 km/h" />
        <Metric value="−0.9" unit="%" label="Front lift" />
      </div>
    ),
  },
  {
    id: 'aero-low',
    pos: 'left-low',
    t: { at: at('aerodynamics', 0.84), rise: 0.014, fall: 0.016 },
    d: 18,
    node: (
      <p className="t-sub" style={{ fontSize: '13.5px', maxWidth: '44ch' }}>
        Two winglets, a shielded battery underside and a tail that pulls the
        wake away from the rider's back. Scroll faster and watch the flow load up.
      </p>
    ),
  },

  /* ── 08 · Materials ──────────────────────────────────────────────────── */
  {
    id: 'mat-kicker',
    pos: 'left-high',
    t: { at: at('materials', 0.08), rise: 0.012, fall: 0.014 },
    d: 14,
    node: <Kicker>Chapter 08 — Materials</Kicker>,
  },
  {
    id: 'mat-1',
    pos: 'right',
    t: { at: at('materials', 0.26), rise: 0.012, fall: 0.014 },
    d: 20,
    node: (
      <>
        <Kicker>01 / Carbon</Kicker>
        <p className="t-display" style={{ fontSize: 'clamp(22px, 2.8vw, 40px)', margin: '12px 0 10px' }}>
          Pre-preg twill
        </p>
        <p className="t-sub" style={{ fontSize: '13.5px', maxWidth: '28ch' }}>
          Autoclave cured at 6 bar. Four coats of clear, hand flat, 42 hours.
        </p>
      </>
    ),
  },
  {
    id: 'mat-2',
    pos: 'left',
    t: { at: at('materials', 0.46), rise: 0.012, fall: 0.014 },
    d: 20,
    node: (
      <>
        <Kicker>02 / Aluminium</Kicker>
        <p className="t-display" style={{ fontSize: 'clamp(22px, 2.8vw, 40px)', margin: '12px 0 10px' }}>
          7075-T6, 5-axis
        </p>
        <p className="t-sub" style={{ fontSize: '13.5px', maxWidth: '28ch' }}>
          Machined from billet in one continuous pass. 0.04 mm tolerance across
          a 1.4 m part.
        </p>
      </>
    ),
  },
  {
    id: 'mat-3',
    pos: 'left-high',
    t: { at: at('materials', 0.63), rise: 0.012, fall: 0.014 },
    d: 18,
    node: (
      <>
        <Kicker>03 / Titanium</Kicker>
        <p className="t-display" style={{ fontSize: 'clamp(22px, 2.8vw, 40px)', margin: '12px 0 10px' }}>
          Grade 5
        </p>
        <p className="t-sub" style={{ fontSize: '13.5px', maxWidth: '30ch' }}>
          Every fastener that sees heat or load reversal. Nothing else survives
          the duty cycle.
        </p>
      </>
    ),
  },
  {
    id: 'mat-4',
    pos: 'left-low',
    t: { at: at('materials', 0.78), rise: 0.012, fall: 0.014 },
    d: 18,
    node: (
      <>
        <Kicker>04 / Rubber</Kicker>
        <p className="t-display" style={{ fontSize: 'clamp(20px, 2.4vw, 34px)', margin: '10px 0 8px' }}>
          200-section rear
        </p>
        <p className="t-sub" style={{ fontSize: '13px', maxWidth: '30ch' }}>
          A bespoke compound developed for instant torque delivery.
        </p>
      </>
    ),
  },
  {
    id: 'mat-5',
    pos: 'center-low',
    t: { at: at('materials', 0.92), rise: 0.012, fall: 0.014 },
    d: 16,
    node: (
      <p className="t-sub" style={{ fontSize: 'clamp(14px, 1.4vw, 18px)', maxWidth: '46ch', margin: '0 auto' }}>
        Five materials, chosen once, for the whole machine.
      </p>
    ),
  },

  /* ── 09 · Signature lighting ─────────────────────────────────────────── */
  {
    id: 'lit-kicker',
    pos: 'left-high',
    t: { at: at('lighting', 0.12), rise: 0.014, fall: 0.016 },
    d: 16,
    node: <Kicker>Chapter 09 — Signature</Kicker>,
  },
  {
    id: 'lit-main',
    pos: 'left',
    t: { at: at('lighting', 0.3), rise: 0.014, fall: 0.016 },
    d: 22,
    node: (
      <>
        <p className="t-display" style={{ fontSize: 'clamp(26px, 3.4vw, 52px)' }}>
          It looks back
          <br />
          at you.
        </p>
        <p className="t-sub" style={{ fontSize: '13.5px', marginTop: '14px', maxWidth: '31ch' }}>
          A vertical DRL blade between two matrix projectors. 128 individually
          addressable elements, levelled 400 times a second.
        </p>
      </>
    ),
  },
  {
    id: 'lit-right',
    pos: 'right',
    t: { at: at('lighting', 0.62), rise: 0.014, fall: 0.016 },
    d: 20,
    node: (
      <div style={{ display: 'grid', gap: '22px', justifyItems: 'end' }}>
        <Metric value="1 940" unit="lm" label="Low beam" />
        <Metric value="3 100" unit="lm" label="High beam" />
        <Metric value="620" unit="m" label="Throw distance" />
      </div>
    ),
  },
  {
    id: 'lit-low',
    pos: 'left-low',
    t: { at: at('lighting', 0.86), rise: 0.014, fall: 0.016 },
    d: 18,
    node: <span className="t-label">Ambient signature · 6 zones · brake-linked tail</span>,
  },

  /* ── 10 · Interface ──────────────────────────────────────────────────── */
  {
    id: 'ckp-kicker',
    pos: 'left-high',
    t: { at: at('cockpit', 0.1), rise: 0.014, fall: 0.016 },
    d: 16,
    node: <Kicker>Chapter 10 — Interface</Kicker>,
  },
  {
    id: 'ckp-main',
    pos: 'left',
    t: { at: at('cockpit', 0.3), rise: 0.014, fall: 0.016 },
    d: 22,
    node: (
      <>
        <p className="t-display" style={{ fontSize: 'clamp(24px, 3.2vw, 48px)' }}>
          Six point two
          <br />
          inches of calm.
        </p>
        <p className="t-sub" style={{ fontSize: '13.5px', marginTop: '14px', maxWidth: '30ch' }}>
          Bonded directly to the upper yoke. No bracket, no rattle, no glare.
          Everything you need, once.
        </p>
      </>
    ),
  },
  {
    id: 'ckp-keys',
    pos: 'right-low',
    t: { at: at('cockpit', 0.56), rise: 0.014, fall: 0.016 },
    d: 18,
    node: (
      <div style={{ display: 'grid', gap: '8px', justifyItems: 'end' }}>
        <span className="t-label">Bar controls</span>
        <span className="t-value" style={{ fontSize: '12px' }}>Left · mode, menu, cruise</span>
        <span className="t-value" style={{ fontSize: '12px' }}>Right · power, map, hazards</span>
      </div>
    ),
  },
  {
    id: 'ckp-safe',
    pos: 'left-low',
    t: { at: at('cockpit', 0.8), rise: 0.014, fall: 0.016 },
    d: 16,
    node: (
      <p className="t-sub" style={{ fontSize: '13px', maxWidth: '42ch' }}>
        Blind-spot radar, cornering ABS, wheelie mitigation and a six-axis IMU
        that samples at 1 kHz.
      </p>
    ),
  },

  /* ── 11 · Velocity ───────────────────────────────────────────────────── */
  {
    id: 'ride-kicker',
    pos: 'left-high',
    t: { at: at('ride', 0.12), rise: 0.014, fall: 0.016 },
    d: 14,
    node: <Kicker>Chapter 11 — Velocity</Kicker>,
  },
  {
    id: 'ride-main',
    pos: 'left',
    t: { at: at('ride', 0.36), rise: 0.016, fall: 0.018 },
    d: 24,
    node: (
      <>
        <p className="t-display" style={{ fontSize: 'clamp(30px, 4.4vw, 68px)' }}>
          Silence,
          <br />
          then horizon.
        </p>
      </>
    ),
  },
  {
    id: 'ride-right',
    pos: 'right',
    t: { at: at('ride', 0.56), rise: 0.014, fall: 0.016 },
    d: 20,
    node: (
      <div style={{ display: 'grid', gap: '22px', justifyItems: 'end' }}>
        <Metric value="2.4" unit="s" label="0 – 100 km/h" />
        <Metric value="6.9" unit="s" label="0 – 200 km/h" />
        <Metric value="117" unit="km" label="Highway range" />
      </div>
    ),
  },
  {
    id: 'ride-low',
    pos: 'left-low',
    t: { at: at('ride', 0.8), rise: 0.014, fall: 0.016 },
    d: 18,
    node: (
      <p className="t-sub" style={{ fontSize: '13.5px', maxWidth: '44ch' }}>
        Regeneration is dialled by the left lever, not a menu. Trail the brake
        and you get 60 kW back.
      </p>
    ),
  },

  /* ── 12 · Finale ─────────────────────────────────────────────────────── */
  {
    id: 'fin-wordmark',
    pos: 'finale-top',
    t: { at: at('finale', 0.42), rise: 0.024, fall: 0.03 },
    d: 34,
    node: (
      <>
        <h2 className="t-display brand-mark" style={{ fontSize: 'clamp(44px, 7.6vw, 132px)' }}>
          Nebula
          <span className="x1">X1</span>
        </h2>
        <p className="t-sub" style={{ fontSize: 'clamp(15px, 1.6vw, 22px)', marginTop: '26px' }}>
          Built for what comes next.
        </p>
      </>
    ),
  },
  {
    id: 'fin-cta',
    pos: 'finale-bottom',
    t: { at: at('finale', 0.6), rise: 0.02, fall: 0.028 },
    d: 22,
    node: (
      <div className="cta-row" style={{ justifyContent: 'center' }}>
        <a className="btn btn--solid" href="#specifications" data-cta="reserve">
          Reserve
        </a>
        <a className="btn" href="#specifications" data-cta="specs">
          Explore specifications
        </a>
      </div>
    ),
  },
]

/** Only used by the reduced-motion / no-WebGL presentation. */
export function staticCaptionOpacity(c: Caption, p: number) {
  return envelope(p, resolve(c.t))
}
