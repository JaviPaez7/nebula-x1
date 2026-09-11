import { Footer, SpecSection } from './SpecSheet'

/**
 * The no-WebGL / reduced-motion presentation.
 *
 * If the machine cannot be drawn, the product still has to be sellable: the
 * same story, the same figures, the same identity — told with layout and
 * typography instead of shaders. Nothing is hidden and nothing is missing.
 */
export function Fallback({ reason }: { reason: string }) {
  return (
    <div className="fallback">
      <header className="fb-hero">
        <div className="t-kicker">Nebula X1 — {reason}</div>
        <h1 className="t-display brand-mark fb-title">
          Nebula
          <span className="x1">X1</span>
        </h1>
        <p className="t-sub" style={{ fontSize: 'clamp(16px, 1.8vw, 24px)', maxWidth: '30ch' }}>
          Electricity, weaponized.
        </p>
        <p className="t-sub" style={{ fontSize: 14, maxWidth: '52ch' }}>
          A 165 kW electric hyperbike. 310 Nm from zero rpm, 0–100 km/h in 2.4
          seconds, and a 120 kWh equivalent pack that refills from 10 to 80 % in
          fourteen minutes.
        </p>
      </header>

      <div className="fb-spec">
        <div>
          <span className="t-label">0 – 100 km/h</span>
          <b>2.4 s</b>
        </div>
        <div>
          <span className="t-label">Peak power</span>
          <b>165 kW</b>
        </div>
        <div>
          <span className="t-label">Torque</span>
          <b>310 Nm</b>
        </div>
        <div>
          <span className="t-label">Top speed</span>
          <b>285 km/h</b>
        </div>
      </div>

      <SpecSection />
      <Footer />
    </div>
  )
}
