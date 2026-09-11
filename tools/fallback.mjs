/**
 * Development-only: prove the no-WebGL presentation.
 *
 * Launches Chrome with 3D APIs disabled, so `getContext('webgl')` returns null
 * exactly as it would on a machine without GPU acceleration, and checks that
 * the page still presents the product, its figures and its specification.
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const URL_BASE = process.env.TARGET_URL || 'http://127.0.0.1:5188/'
const PORT = 9346
const OUT = 'shots/fallback'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
mkdirSync(OUT, { recursive: true })

const profile = mkdtempSync(join(tmpdir(), 'nebula-nowebgl-'))
const chrome = spawn(
  CHROME,
  [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--window-size=1440,900',
    '--headless=new',
    '--hide-scrollbars',
    '--no-first-run',
    '--disable-3d-apis',
    '--disable-webgl',
    '--disable-webgl2',
    URL_BASE,
  ],
  { stdio: 'ignore' },
)

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
      } else if (m.method === 'Log.entryAdded') this.logs.push(`[${m.params.entry.level}] ${m.params.entry.text}`)
      else if (m.method === 'Runtime.exceptionThrown')
        this.logs.push('[exception] ' + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text))
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
      }, 30000)
    })
  }
  async eval(e) {
    const r = await this.send('Runtime.evaluate', { expression: e, returnByValue: true })
    return r.result.value
  }
}

let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

try {
  let target = null
  for (let i = 0; i < 60 && !target; i++) {
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
  await sleep(7000)

  const state = JSON.parse(
    await cdp.eval(`JSON.stringify({
      webgl: (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')) } catch { return false } })(),
      canvas: !!document.querySelector('canvas'),
      fallback: !!document.querySelector('.fallback'),
      title: (document.querySelector('.fb-title') || {}).textContent || '',
      specs: document.querySelectorAll('.spec-row').length,
      figures: Array.from(document.querySelectorAll('.fb-spec b')).map((b) => b.textContent),
      ctaCount: document.querySelectorAll('.fallback .btn').length,
      bodyHeight: document.body.scrollHeight,
    })`),
  )
  await cdp.send('Page.captureScreenshot', { format: 'png' })
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(OUT, 'no-webgl.png'), Buffer.from(shot.data, 'base64'))

  check('WebGL is genuinely unavailable', state.webgl === false)
  check('no canvas is created', state.canvas === false)
  check('static presentation renders', state.fallback === true)
  check('product name is present', /Nebula/i.test(state.title), state.title.replace(/\s+/g, ' ').trim())
  check('headline figures are present', state.figures.length === 4, state.figures.join(' · '))
  check('specification sheet is reachable', state.specs > 30, `${state.specs} rows`)
  check('calls to action are present', state.ctaCount >= 1, `${state.ctaCount} buttons`)
  check('page is scrollable content, not an empty shell', state.bodyHeight > 1200, `${state.bodyHeight}px`)

  const bad = cdp.logs.filter(
    (l) => (l.includes('[error]') || l.includes('[exception]')) && !/favicon/i.test(l),
  )
  check('no console errors in fallback', bad.length === 0, bad.join(' | ').slice(0, 200))
} finally {
  console.log(failed ? `\n${failed} checks failed` : '\nall fallback checks passed')
  chrome.kill()
  await sleep(300)
  try {
    rmSync(profile, { recursive: true, force: true })
  } catch {}
  process.exit(failed ? 1 : 0)
}
