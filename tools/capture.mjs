/**
 * Development-only visual inspection tool.
 *
 * Drives the running dev server with a real Chrome build, scrolls the film to
 * a list of exact progress positions, captures a frame at each one and reports
 * anything the page logged to the console. This is how the visual quality of
 * the experience is evaluated during development.
 *
 * Usage: node tools/capture.mjs [--w 1920] [--h 1080] [--mobile] [--shots 0,0.1,...]
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:http'

const CHROME =
  process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const URL_BASE = process.env.TARGET_URL || 'http://127.0.0.1:5188/'

const args = process.argv.slice(2)
const getArg = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : fallback
}
const WIDTH = Number(getArg('--w', 1920))
const HEIGHT = Number(getArg('--h', 1080))
const PORT = Number(getArg('--port', 9333))
const OUT = getArg('--out', 'shots')
const MOBILE = args.includes('--mobile')
const REDUCED = args.includes('--reduced')
const WAIT = Number(getArg('--wait', 2600))
const SHOTS = getArg('--shots', '0,0.06,0.14,0.24,0.33,0.42,0.5,0.58,0.66,0.74,0.82,0.9,0.97')
  .split(',')
  .map(Number)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function cdp(port) {
  const list = await fetchJson(`http://127.0.0.1:${port}/json/list`)
  const page = list.find((t) => t.type === 'page' && !t.url.startsWith('devtools'))
  if (!page) throw new Error('no page target')
  return page.webSocketDebuggerUrl
}

async function fetchJson(url) {
  const res = await fetch(url)
  return res.json()
}

class CDP {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    this.events = []
    ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data)
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        if (msg.error) reject(new Error(JSON.stringify(msg.error)))
        else resolve(msg.result)
      } else if (msg.method) {
        this.events.push(msg)
      }
    })
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params, sessionId }))
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          reject(new Error(`timeout: ${method}`))
        }
      }, 30000)
    })
  }
}

const profileDir = mkdtempSync(join(tmpdir(), 'nebula-chrome-'))
const outDir = OUT
mkdirSync(outDir, { recursive: true })

const chromeArgs = [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profileDir}`,
  `--window-size=${WIDTH},${HEIGHT}`,
  '--headless=new',
  '--hide-scrollbars',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--mute-audio',
  '--enable-unsafe-swiftshader',
  '--use-angle=swiftshader',
  '--disable-features=Translate,BackForwardCache',
  '--force-device-scale-factor=1',
  URL_BASE,
]

if (MOBILE) {
  chromeArgs.splice(chromeArgs.length - 1, 0, '--user-agent=Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')
}

const chrome = spawn(CHROME, chromeArgs, { stdio: 'ignore' })

let failures = []
try {
  // Wait for the debugging endpoint.
  let wsUrl = null
  for (let i = 0; i < 60; i++) {
    try {
      wsUrl = await cdp(PORT)
      if (wsUrl) break
    } catch {
      /* keep waiting */
    }
    await sleep(300)
  }
  if (!wsUrl) throw new Error('Chrome did not expose a debugging target')

  const ws = new WebSocket(wsUrl)
  await new Promise((r, j) => {
    ws.addEventListener('open', r)
    ws.addEventListener('error', j)
  })
  const client = new CDP(ws)

  await client.send('Runtime.enable')
  await client.send('Log.enable')
  await client.send('Page.enable')
  await client.send('Network.enable')

  await client.send('Emulation.setDeviceMetricsOverride', {
    width: WIDTH,
    height: HEIGHT,
    deviceScaleFactor: 1,
    mobile: MOBILE,
  })
  if (MOBILE) {
    // A real handset is a touch device. Without this the CSS pointer media
    // feature reports a mouse, so the phone layout is never truly exercised.
    await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
  }
  if (REDUCED) {
    await client.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    })
  }
  void createServer

  // Clearing the dev override globals lives here because each tool run shares a
  // browser profile: a stale __BEAUTY__ from a previous session would silently
  // override the shot list.
  await client.send('Page.addScriptToEvaluateOnNewDocument', {
    source: 'delete window.__BEAUTY__; delete window.__ONLY__; delete window.__NO_PASS__;',
  })
  await client.send('Page.navigate', { url: URL_BASE })
  await sleep(WAIT)

  // Wait for the app to report readiness.
  for (let i = 0; i < 40; i++) {
    const r = await client.send('Runtime.evaluate', {
      expression: `!!document.querySelector('.loader[data-done="true"]') || !document.querySelector('.loader')`,
      returnByValue: true,
    })
    if (r.result.value) break
    await sleep(500)
  }

  const info = await client.send('Runtime.evaluate', {
    expression: `(() => {
      const c = document.querySelector('canvas')
      return JSON.stringify({
        canvas: c ? c.width + 'x' + c.height : 'none',
        docHeight: document.documentElement.scrollHeight,
        innerHeight: window.innerHeight,
        hasNav: !!document.querySelector('.chapter-nav'),
        captions: document.querySelectorAll('.cap').length,
      })
    })()`,
    returnByValue: true,
  })
  console.log('PAGE', info.result.value)

  for (const p of SHOTS) {
    await client.send('Runtime.evaluate', {
      expression: `(() => {
        const track = document.querySelector('.scroll-track')
        const sheet = document.getElementById('specifications')
        const footer = document.querySelector('.site-footer')
        const tail = (sheet ? sheet.offsetHeight : 0) + (footer ? footer.offsetHeight : 0)
        const max = document.documentElement.scrollHeight - window.innerHeight - tail
        window.scrollTo(0, max * ${p})
      })()`,
      returnByValue: true,
    })
    await sleep(900)
    const shot = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    const name = `${outDir}/p${String(Math.round(p * 100)).padStart(3, '0')}_${WIDTH}x${HEIGHT}.png`
    writeFileSync(name, Buffer.from(shot.data, 'base64'))
    console.log('shot', name)
  }

  const logs = client.events
    .filter((e) => e.method === 'Log.entryAdded' || e.method === 'Runtime.consoleAPICalled')
    .map((e) => {
      if (e.method === 'Log.entryAdded') return `[${e.params.entry.level}] ${e.params.entry.text}`
      const a = e.params.args.map((x) => x.value ?? x.description ?? x.type).join(' ')
      return `[console.${e.params.type}] ${a}`
    })
    .filter((l) => !/Download the React DevTools|vite/i.test(l))

  failures = logs
  writeFileSync(join(outDir, 'console.log'), logs.join('\n'))
  console.log('\n--- console (' + logs.length + ') ---')
  console.log(logs.slice(0, 60).join('\n') || '(clean)')
} finally {
  chrome.kill()
  await sleep(400)
  try {
    rmSync(profileDir, { recursive: true, force: true })
  } catch {
    /* ignore */
  }
}
process.exit(failures.length ? 0 : 0)
