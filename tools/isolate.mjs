/**
 * Development-only: capture the machine with individual assemblies isolated.
 * Usage: node tools/isolate.mjs --only "battery" --progress 0.3
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
const PORT = Number(getArg('--port', 9338))
const W = Number(getArg('--w', 1200))
const H = Number(getArg('--h', 675))
const P = Number(getArg('--progress', 0.3))
const VIEW = Number(getArg('--view', 1))
const OUT = getArg('--out', 'shots/iso')
const ONLY = getArg('--only', '')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
mkdirSync(OUT, { recursive: true })

const profile = mkdtempSync(join(tmpdir(), 'nebula-iso-'))
const chrome = spawn(
  CHROME,
  [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    `--window-size=${W},${H}`,
    '--headless=new',
    '--hide-scrollbars',
    '--no-first-run',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
    URL_BASE,
  ],
  { stdio: 'ignore' },
)

class CDP {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data)
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id)
        this.pending.delete(m.id)
        m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result)
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
  await sleep(7000)
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const sheet = document.getElementById('specifications')
      const footer = document.querySelector('.site-footer')
      const tail = (sheet?sheet.offsetHeight:0)+(footer?footer.offsetHeight:0)
      window.scrollTo(0, (document.documentElement.scrollHeight - window.innerHeight - tail) * ${P})
    })()`,
  })
  await sleep(1500)
  await cdp.send('Runtime.evaluate', { expression: `window.__BEAUTY__ = ${VIEW}` })
  await sleep(1200)

  for (const only of ONLY.split('|')) {
    await cdp.send('Runtime.evaluate', { expression: `window.__ONLY__ = ${JSON.stringify(only)}` })
    await sleep(1200)
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' })
    const safe = (only || 'all').replace(/[^a-z0-9]+/gi, '_')
    const name = `${OUT}/${safe}.png`
    writeFileSync(name, Buffer.from(shot.data, 'base64'))
    console.log('shot', name)
  }
} finally {
  chrome.kill()
  await sleep(300)
  try {
    rmSync(profile, { recursive: true, force: true })
  } catch {}
}
