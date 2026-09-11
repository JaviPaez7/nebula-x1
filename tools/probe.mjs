/**
 * Development-only introspection probe.
 * Reports what the renderer is actually doing at a given point in the film.
 *
 * Usage: node tools/probe.mjs [--p 0.2]
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const URL_BASE = process.env.TARGET_URL || 'http://127.0.0.1:5188/'
const args = process.argv.slice(2)
const getArg = (n, d) => {
  const i = args.indexOf(n)
  return i >= 0 ? args[i + 1] : d
}
const PORT = Number(getArg('--port', 9335))
const P = Number(getArg('--p', 0.2))
const W = Number(getArg('--w', 1280))
const H = Number(getArg('--h', 720))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const profile = mkdtempSync(join(tmpdir(), 'nebula-probe-'))
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
    this.logs = []
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data)
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id)
        this.pending.delete(m.id)
        m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result)
      } else if (m.method === 'Log.entryAdded') {
        this.logs.push(`[${m.params.entry.level}] ${m.params.entry.text}`)
      } else if (m.method === 'Runtime.consoleAPICalled') {
        this.logs.push('[console] ' + m.params.args.map((a) => a.value ?? a.description ?? a.type).join(' '))
      } else if (m.method === 'Runtime.exceptionThrown') {
        this.logs.push(`[exception] ${m.params.exceptionDetails.text} ${m.params.exceptionDetails.exception?.description ?? ''}`)
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
      }, 30000)
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
  await cdp.send('Log.enable')
  await sleep(7000)

  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const sheet = document.getElementById('specifications')
      const footer = document.querySelector('.site-footer')
      const tail = (sheet?sheet.offsetHeight:0)+(footer?footer.offsetHeight:0)
      const max = document.documentElement.scrollHeight - window.innerHeight - tail
      window.scrollTo(0, max * ${P})
    })()`,
  })
  await sleep(1800)

  const r = await cdp.send('Runtime.evaluate', {
    expression: `JSON.stringify(window.__NEBULA__ ? window.__NEBULA__.report() : {missing:true}, null, 1)`,
    returnByValue: true,
  })
  console.log(r.result.value)
  if (r.exceptionDetails) console.log('EXC', r.exceptionDetails.text)
  console.log('--- logs ---')
  console.log(cdp.logs.slice(0, 30).join('\n') || '(none)')
} finally {
  chrome.kill()
  await sleep(300)
  try {
    rmSync(profile, { recursive: true, force: true })
  } catch {}
}
