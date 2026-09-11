import type { JSX } from 'react'

/**
 * Full specification, in the same mono/steel language as the film.
 * This section is also the accessible, no-WebGL home for every figure quoted
 * anywhere in the experience.
 */
const SPECS: { title: string; rows: [string, string][] }[] = [
  {
    title: 'Powertrain',
    rows: [
      ['Drive unit', 'PMSM, transverse flux'],
      ['Peak power', '165 kW'],
      ['Torque', '310 Nm from 0 rpm'],
      ['Final drive', 'Carbon belt · 1:8.4'],
      ['Cooling', 'Direct oil, stator + rotor'],
      ['Peak efficiency', '96.4 %'],
    ],
  },
  {
    title: 'Energy',
    rows: [
      ['Architecture', '120 kWh equivalent'],
      ['System voltage', '800 V nominal'],
      ['Peak charge', '350 kW DC'],
      ['10 – 80 %', '14 minutes'],
      ['Cell chemistry', 'NMC 9½½, silicone anode'],
      ['Thermal', 'Immersion-cooled modules'],
    ],
  },
  {
    title: 'Performance',
    rows: [
      ['0 – 100 km/h', '2.4 s'],
      ['0 – 200 km/h', '6.9 s'],
      ['Top speed', '285 km/h'],
      ['Drag coefficient', '0.28 Cd (with rider)'],
      ['Downforce', '+14 kg at 180 km/h'],
      ['Regeneration', 'up to 60 kW'],
    ],
  },
  {
    title: 'Chassis',
    rows: [
      ['Frame', 'Bonded aluminium monocoque'],
      ['Front', '48 mm TiN fork, fully adjustable'],
      ['Rear', 'Underslung swingarm, rising rate'],
      ['Brakes', 'Dual 330 mm · radial monobloc'],
      ['Wheels', 'Forged 7075 · 3.50 / 6.00 in'],
      ['Tyres', '120/70 ZR17 · 200/55 ZR17'],
    ],
  },
  {
    title: 'Dimensions',
    rows: [
      ['Wheelbase', '1 380 mm'],
      ['Seat height', '842 mm'],
      ['Rake / trail', '25° / 98 mm'],
      ['Kerb weight', '208 kg'],
      ['Distribution', '51 / 49 front–rear'],
      ['Ground clearance', '148 mm'],
    ],
  },
  {
    title: 'Ownership',
    rows: [
      ['Series', 'Nebula X1'],
      ['Production', '2027 · limited to 1 200'],
      ['Warranty', '5 years, unlimited distance'],
      ['Battery warranty', '8 years · 160 000 km'],
      ['Service interval', '24 000 km'],
      ['Reservation', 'Fully refundable'],
    ],
  },
]

export function SpecSection(): JSX.Element {
  return (
    <section className="spec-section" id="specifications" aria-label="Specifications">
      <div className="spec-head">
        <div>
          <div className="t-kicker">Chapter 12 — The machine</div>
          <h2 className="t-display" style={{ marginTop: 16 }}>
            Built for what
            <br />
            comes next.
          </h2>
        </div>
        <div style={{ maxWidth: '34ch' }}>
          <p className="t-sub" style={{ fontSize: 15 }}>
            Twelve systems, one ride. Every figure below is a production target
            for the 2027 series machine, homologated for Europe, Japan and North
            America.
          </p>
          <div className="cta-row" style={{ marginTop: 26 }}>
            <a className="btn btn--solid" href="#reserve">
              Reserve
            </a>
            <a className="btn" href="#top">
              Watch again
            </a>
          </div>
        </div>
      </div>

      <div className="spec-grid">
        {SPECS.map((col) => (
          <div className="spec-col" key={col.title}>
            <h3>{col.title}</h3>
            <dl>
              {col.rows.map(([k, v]) => (
                <div className="spec-row" key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  )
}

export function Footer(): JSX.Element {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div>
          <div className="chrome-wordmark" style={{ marginBottom: 14 }}>
            <i />
            <span>Nebula X1</span>
          </div>
          <p className="t-sub" style={{ fontSize: 12.5, maxWidth: '38ch' }}>
            Nebula is a fictional marque created to demonstrate a scroll-driven
            WebGL product experience. No vehicle is offered for sale.
          </p>
        </div>
        <div className="site-footer-links">
          <span className="t-label">Built with React · TypeScript · three.js · GSAP</span>
          <span className="t-label">All geometry generated at runtime</span>
          <span className="t-label">© 2027 Nebula Works</span>
        </div>
      </div>
    </footer>
  )
}
