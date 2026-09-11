/**
 * Development-only acceptance run.
 *
 * Drives the real page through the behaviours that matter and reports pass or
 * fail for each: forward and reverse scrubbing, chapter navigation, mid-page
 * refresh, window resize, mobile emulation, reduced motion, and the console.
 *
 * Usage: node tools/verify.mjs [--w 1920] [--h 1080] [--label desktop]
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const URL_BASE = process.env.TARGET_URL || 'http://127.0.0.1:5188/'
const args = process.argv.slice(2)
const getArg = (n, d) => {
  const i = args.indexOf(n)
  return i >= 0 ? args[i + 1] : d
}
const PORT = Number(getArg('--port', 9340))
const W = Number(getArg('--w', 1920))
const H = Number(getArg('--h', 1080))
const LABEL = getArg('--label', 'desktop')
const MOBILE = args.includes('--mobile')
const REDUCED = args.includes('--reduced')
const OUT = getArg('--out', `shots/verify-${LABEL}`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
mkdirSync(OUT, { recursive: true })

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const profile = mkdtempSync(join(tmpdir(), 'nebula-verify-'))
const chromeArgs = [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  `--window-size=${W},${H}`,
  '--headless=new',
  '--hide-scrollbars',
  '--no-first-run',
  '--enable-unsafe-swiftshader',
  '--use-angle=swiftshader',
  URL_BASE,
]
if (MOBILE) {
  chromeArgs.splice(1, 0, '--user-agent=Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')
}
const chrome = spawn(CHROME, chromeArgs, { stdio: 'ignore' })

class CDP {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    this.logs = []
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data)
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id)
        this.pending.delete(m.id)
        m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result)
      } else if (m.method === 'Log.entryAdded') {
        this.logs.push({ level: m.params.entry.level, text: m.params.entry.text })
      } else if (m.method === 'Runtime.consoleAPICalled') {
        this.logs.push({
          level: m.params.type,
          text: m.params.args.map((a) => a.value ?? a.description ?? a.type).join(' '),
        })
      } else if (m.method === 'Runtime.exceptionThrown') {
        this.logs.push({
          level: 'exception',
          text: m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text,
        })
      }
    })
  }
  send(method, params = {}) {
    const id = ++this.id
    return new Promise((res, rej) => {
      this.pending.set(id, { resolve: res, reject: rej })
      this.ws.send(JSON.stringify({ id, method, params }))
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          rej(new Error('timeout ' + method))
        }
      }, 40000)
    })
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'eval failed')
    return r.result.value
  }
  async shot(name) {
    const s = await this.send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(join(OUT, `${name}.png`), Buffer.from(s.data, 'base64'))
  }
}

/**
 * Drive the film.
 *
 * The dev server exposes the application's own scroll controller, and that is
 * the honest way to move it: setting `window.scrollTo` directly fights Lenis's
 * animation state and produces harness artefacts rather than real findings.
 *
 * The production bundle strips that hook, so there the harness uses the
 * browser's real wheel input instead — the same path a visitor takes. Wheel
 * deltas are re-measured every frame rather than fired in a burst, because
 * dispatching a batch of them inside one frame makes the inertial controller
 * accumulate momentum and sail straight past the destination.
 */
async function drive(cdp, p, { timeout = 45000 } = {}) {
  const viaApi = await cdp.eval(`!!window.__NAV__`)
  if (viaApi) {
    await cdp.eval(`window.__NAV__.to(${p}, 1.1)`)
    return 'api'
  }
  const deadline = Date.now() + timeout
  let previous = null
  let still = 0
  while (Date.now() < deadline) {
    const state = JSON.parse(
      await cdp.eval(`(() => {
        const sheet = document.getElementById('specifications')
        const footer = document.querySelector('.site-footer')
        const tail = (sheet ? sheet.offsetHeight : 0) + (footer ? footer.offsetHeight : 0)
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight - tail)
        const y = window.scrollY
        return JSON.stringify({
          y,
          max,
          vh: window.innerHeight,
          progress: Math.round((y / max) * 10000) / 10000,
        })
      })()`),
    )
    const { y, max, vh, progress } = state
    const dyPx = max * p - y
    // Real wheel input carries momentum, so the loop stops once the film has
    // both arrived and stopped moving rather than the moment it is in range.
    if (Math.abs(dyPx) < vh * 0.05 && previous !== null && Math.abs(progress - previous) < 0.0004) {
      still += 1
      if (still >= 3) break
    } else {
      still = 0
    }
    previous = progress
    if (Math.abs(dyPx) > vh * 0.03) {
      const step = Math.max(-700, Math.min(700, dyPx))
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mouseWheel',
        x: Math.round((await sizeOf(cdp)).w / 2),
        y: Math.round((await sizeOf(cdp)).h / 2),
        deltaX: 0,
        deltaY: step,
      })
    }
    await sleep(80)
  }
  return 'wheel'
}

let viewportCache = null
async function sizeOf(cdp) {
  if (!viewportCache) {
    viewportCache = JSON.parse(
      await cdp.eval(`JSON.stringify({ w: window.innerWidth, h: window.innerHeight })`),
    )
  }
  return viewportCache
}

/** Realised scroll position, in progress units, read from the HUD. */
const readProgress = `(() => {
  const el = document.querySelector('.chrome-br span span') || document.querySelector('.chrome-br span')
  return el ? el.textContent : ''
})()`

/**
 * Wait until the film has finished moving.
 *
 * Where the dev hook exists it reports the scroll controller's own animation
 * flag, so there is no guesswork. In production the harness watches the raw
 * scroll offset instead.
 */
async function settle(cdp, tries = 90) {
  let last = null
  let stable = 0
  for (let i = 0; i < tries; i++) {
    await sleep(160)
    const v = await cdp.eval(
      `JSON.stringify(window.__NAV__ ? window.__NAV__.read() : (() => {
        const sheet = document.getElementById('specifications')
        const footer = document.querySelector('.site-footer')
        const tail = (sheet ? sheet.offsetHeight : 0) + (footer ? footer.offsetHeight : 0)
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight - tail)
        return {
          y: Math.round(window.scrollY),
          max: Math.round(max),
          settling: false,
          progress: Math.round((window.scrollY / max) * 10000) / 10000,
        }
      })())`,
    )
    const parsed = JSON.parse(v)
    if (parsed.settling) {
      stable = 0
      last = v
      continue
    }
    if (v === last) {
      stable++
      if (stable >= 3) return parsed
    } else {
      stable = 0
      last = v
    }
  }
  return JSON.parse(last ?? '{}')
}

/** True when the visitor asked for reduced motion, so navigation is instant. */
async function isReduced(cdp) {
  return cdp.eval(`window.matchMedia('(prefers-reduced-motion: reduce)').matches`)
}

try {
  let target = null
  for (let i = 0; i < 80 && !target; i++) {
    try {
      const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      target = l.find((t) => t.type === 'page')
    } catch {}
    if (!target) await sleep(300)
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((r, j) => {
    ws.addEventListener('open', r)
    ws.addEventListener('error', j)
  })
  const cdp = new CDP(ws)
  await cdp.send('Runtime.enable')
  await cdp.send('Log.enable')
  await cdp.send('Page.enable')
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: 'delete window.__BEAUTY__; delete window.__ONLY__; delete window.__NO_PASS__;',
  })
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: W,
    height: H,
    deviceScaleFactor: 1,
    mobile: MOBILE,
  })
  if (MOBILE) {
    // Make the pointer coarse too, so touch-specific CSS is exercised the way
    // it would be on a real handset rather than only shrinking the viewport.
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
    await cdp.send('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' })
  }
  if (REDUCED) {
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    })
  }

  await cdp.send('Page.navigate', { url: URL_BASE })
  await sleep(7000)

  /* ---- 1. boot ------------------------------------------------------- */
  const boot = JSON.parse(
    await cdp.eval(`JSON.stringify({
      canvas: !!document.querySelector('canvas'),
      canvasSize: (() => { const c = document.querySelector('canvas'); return c ? c.width + 'x' + c.height : 'none' })(),
      nav: document.querySelectorAll('.chapter-nav button').length,
      captions: document.querySelectorAll('.cap').length,
      docHeight: document.documentElement.scrollHeight,
      maxScroll: (() => {
        const s = document.getElementById('specifications')
        const f = document.querySelector('.site-footer')
        const tail = (s?s.offsetHeight:0)+(f?f.offsetHeight:0)
        return document.documentElement.scrollHeight - window.innerHeight - tail
      })(),
      specs: !!document.getElementById('specifications'),
      webgl: (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2')||c.getContext('webgl')) } catch { return false } })(),
    })`),
  )
  check('boots with a WebGL canvas', boot.canvas && boot.canvasSize !== 'none', boot.canvasSize)
  check('chapter navigation present', boot.nav === 12, `${boot.nav} chapters`)
  check('caption rail present', boot.captions >= 40, `${boot.captions} blocks`)
  check('scroll track has length', boot.maxScroll > 5000, `${boot.maxScroll}px`)
  check('specification sheet in document', boot.specs)

  /* ---- 2. forward scrub ---------------------------------------------- */
  await drive(cdp, 0)
  const startState = await settle(cdp)
  await cdp.shot('00-start')
  const atStart = `${Math.round((startState.progress ?? 0) * 1000) / 10}`

  await drive(cdp, 0.5)
  await settle(cdp)
  await cdp.shot('50-mid')
  const atMid = `${Math.round(((await settle(cdp)).progress ?? 0) * 1000) / 10}`

  await drive(cdp, 0.995)
  const endState = await settle(cdp)
  await cdp.shot('99-end')
  const atEnd = `${Math.round((endState.progress ?? 0) * 1000) / 10}`
  check(
    'progress indicator advances',
    atStart !== atMid && atMid !== atEnd,
    `${atStart} → ${atMid} → ${atEnd}`,
  )

  /* ---- 3. reverse scrub --------------------------------------------- */
  // Rewind the whole film and confirm the opening frame is reproduced exactly.
  // That is the real test of a scrubbed timeline, not of a scroll position.
  await drive(cdp, 0.5)
  await settle(cdp)
  await cdp.shot('50-mid-back')
  await drive(cdp, 0)
  const backState = await settle(cdp)
  await cdp.shot('00-back')
  const backStart = `${Math.round((backState.progress ?? 0) * 1000) / 10}`
  check('reverse scroll reproduces the opening', backStart === atStart, `${backStart} vs ${atStart}`)

  // And that any point in the middle of the film is reproducible from either
  // direction, once the inertial scroll has actually come to rest.
  await drive(cdp, 0.07)
  const fwdSeven = await settle(cdp)
  await drive(cdp, 0.52)
  await settle(cdp)
  await drive(cdp, 0.07)
  const backSeven = await settle(cdp)
  const delta = Math.abs((fwdSeven.progress ?? 0) - (backSeven.progress ?? 0))
  check(
    'scrubbing is reversible mid-film',
    delta < 0.002,
    `${fwdSeven.progress?.toFixed(4)} vs ${backSeven.progress?.toFixed(4)}`,
  )

  /* ---- 4. chapter navigation ---------------------------------------- */
  await drive(cdp, 0)
  await settle(cdp)
  const navOk = await cdp.eval(`(() => {
    const buttons = document.querySelectorAll('.chapter-nav button')
    if (buttons.length < 12) return 'no buttons'
    buttons[6].click()
    return 'clicked'
  })()`)
  const navState = await settle(cdp)
  const navProgress = `${Math.round((navState.progress ?? 0) * 1000) / 10}`
  const navActive = await cdp.eval(
    `(() => { const b = document.querySelector('.chapter-nav button[data-active="true"]'); return b ? b.textContent.trim() : 'none' })()`,
  )
  await cdp.shot('nav-chapter-06')
  // Button index 6 is chapter 07 Airflow, whose range starts at 51.1%.
  const navTarget = 0.511 + (0.598 - 0.511) * 0.06
  const navDelta = Math.abs((navState.progress ?? 0) - navTarget)
  check(
    'chapter navigation jumps to the right chapter',
    navOk === 'clicked' && /Airflow|Drive/.test(navActive) && navDelta < 0.004,
    `active: ${navActive} @ ${navProgress}, target ${(navTarget * 100).toFixed(2)}`,
  )

  /* ---- 5. resize ----------------------------------------------------- */
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: Math.round(W * 0.72),
    height: Math.round(H * 0.82),
    deviceScaleFactor: 1,
    mobile: MOBILE,
  })
  await sleep(1800)
  await drive(cdp, 0.4)
  await sleep(1600)
  await cdp.shot('resize')
  const resized = JSON.parse(
    await cdp.eval(`JSON.stringify({
      w: window.innerWidth,
      h: window.innerHeight,
      canvas: (() => { const c = document.querySelector('canvas'); return c ? c.width + 'x' + c.height : 'none' })(),
    })`),
  )
  check('survives a resize', resized.canvas !== 'none', `${resized.w}x${resized.h} canvas ${resized.canvas}`)

  /* ---- 6. mid-page refresh ------------------------------------------- */
  await drive(cdp, 0.68)
  await sleep(1600)
  const beforeRefresh = await cdp.eval(readProgress)
  await cdp.send('Page.reload', { ignoreCache: false })
  await sleep(7000)
  const afterRefresh = JSON.parse(
    await cdp.eval(`JSON.stringify({
      progress: ${readProgress},
      y: Math.round(window.scrollY),
      canvas: !!document.querySelector('canvas'),
      nav: document.querySelectorAll('.chapter-nav button').length,
    })`),
  )
  await cdp.shot('after-refresh')
  check(
    'reloads cleanly mid-page',
    afterRefresh.canvas && afterRefresh.nav === 12,
    `was ${beforeRefresh} now ${afterRefresh.progress}`,
  )

  /* ---- 7. mobile / reduced motion presentation ---------------------- */
  if (MOBILE) {
    // Captions come and go with the film, so presence is measured at a point
    // in the timeline where a caption is authored to be on screen.
    await drive(cdp, 0.2)
    await sleep(2200)
    const mobile = JSON.parse(
      await cdp.eval(`JSON.stringify({
        navHidden: getComputedStyle(document.querySelector('.chapter-nav')).display === 'none',
        telemetryHidden: getComputedStyle(document.querySelector('.telemetry')).display === 'none',
        canvas: !!document.querySelector('canvas'),
        coarse: window.matchMedia('(pointer: coarse)').matches,
        capVisible: (() => {
          const caps = Array.from(document.querySelectorAll('.cap'))
          const live = caps.filter((c) => Number(getComputedStyle(c).getPropertyValue('--o') || 0) > 0.2)
          if (!live.length) return 0
          const r = live[0].getBoundingClientRect()
          // and on screen, not merely present in the DOM
          return r.width > 40 && r.left >= -4 && r.right <= window.innerWidth + 4 ? live.length : -live.length
        })(),
        overflowX: document.documentElement.scrollWidth - window.innerWidth,
      })`),
    )
    check('mobile keeps the 3D experience', mobile.canvas)
    check('mobile shows on-screen captions', mobile.capVisible > 0, `${mobile.capVisible} live`)
    check('mobile hides the desktop-only rail', mobile.navHidden && mobile.telemetryHidden, `coarse pointer: ${mobile.coarse}`)
    check('mobile has no horizontal overflow', mobile.overflowX <= 1, `${mobile.overflowX}px`)
  }

  if (REDUCED) {
    const reduced = JSON.parse(
      await cdp.eval(`JSON.stringify({
        captions: document.querySelectorAll('.cap').length,
        specs: !!document.getElementById('specifications'),
        rows: document.querySelectorAll('.spec-row').length,
      })`),
    )
    check('reduced motion still ships full content', reduced.captions >= 40 && reduced.rows > 30, `${reduced.rows} spec rows`)
  }

  /* ---- 8. console ---------------------------------------------------- */
  const bad = cdp.logs.filter(
    (l) =>
      (l.level === 'error' || l.level === 'exception') &&
      !/favicon|Download the React DevTools|vite/i.test(l.text),
  )
  check('no console errors', bad.length === 0, bad.map((b) => b.text.slice(0, 160)).join(' | '))

  const shots = await cdp.eval(`document.querySelectorAll('.cap').length`)
  void shots
} finally {
  const failed = results.filter((r) => !r.ok)
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(results, null, 2))
  console.log(`\n${results.length - failed.length}/${results.length} checks passed (${LABEL})`)
  chrome.kill()
  await sleep(400)
  try {
    rmSync(profile, { recursive: true, force: true })
  } catch {}
  process.exit(failed.length ? 1 : 0)
}
