/**
 * Publish the site to GitHub Pages.
 *
 * Builds with the project-page base path, publishes the build output to the
 * `gh-pages` branch, enables Pages and waits for the URL to actually serve the
 * built entry point. Publishing the build output as a branch (rather than
 * running a workflow) keeps this independent of Actions, which needs extra
 * token scopes that the GitHub CLI does not request by default.
 *
 * Usage: node tools/deploy.mjs [--repo <name>] [--base <path>]
 */

import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const getArg = (n, d) => {
  const i = args.indexOf(n)
  return i >= 0 ? args[i + 1] : d
}

const REPO = getArg('--repo', 'nebula-x1')
const BRANCH = 'gh-pages'
const USER = execFileSync('gh', ['api', 'user', '--jq', '.login'], { encoding: 'utf8' }).trim()
const BASE = getArg('--base', `/${REPO}/`)
const SITE = `https://${USER.toLowerCase()}.github.io/${REPO}/`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const run = (cmd, argv, opts = {}) =>
  execFileSync(cmd, argv, { encoding: 'utf8', stdio: opts.quiet ? 'pipe' : 'inherit', ...opts })

/**
 * Run an npm script.
 *
 * Recent Node refuses to spawn `.cmd` shims without a shell on Windows, but it
 * also refuses to combine `shell: true` with an argument array in a way that
 * survives quoting. The arguments here are literal and never derived from
 * input, so spelling the whole command out as one shell string is both the
 * supported path and a safe one.
 */
const runNpm = (script, env) =>
  execFileSync(`npm run ${script}`, {
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  })

const capture = (cmd, argv) => execFileSync(cmd, argv, { encoding: 'utf8' }).trim()

const hasRepo = () => {
  try {
    execFileSync('gh', ['repo', 'view', `${USER}/${REPO}`], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

console.log(`\n  NEBULA X1  →  ${SITE}\n`)

/* ---------------------------------------------------------------- 1. build */

console.log('1/5  building with base path ' + BASE)
runNpm('build', { ...process.env, VITE_BASE: BASE })

if (!existsSync('dist/index.html')) throw new Error('build produced no dist/index.html')

// The built entry point must reference the project base path, or every asset
// will 404 once Pages serves it from a subdirectory.
const html = readFileSync('dist/index.html', 'utf8')
const wrongBase = [...html.matchAll(/(?:src|href)="(\/[^"]*)"/g)]
  .map((m) => m[1])
  .filter((u) => !u.startsWith(BASE))
if (wrongBase.length) {
  throw new Error(
    `build used the wrong base path — found ${wrongBase.slice(0, 3).join(', ')}; expected them to start with ${BASE}`,
  )
}
console.log(`     entry point references ${BASE}assets/…`)

/* --------------------------------------------------------------- 2. commit */

const changed = () => {
  try {
    execFileSync('git', ['diff', '--cached', '--quiet'], { stdio: 'ignore' })
    return Boolean(capture('git', ['status', '--porcelain']))
  } catch {
    return true
  }
}

if (!existsSync('.git')) {
  console.log('2/5  initialising repository')
  run('git', ['init', '-q', '-b', 'main'])
}

run('git', ['add', '-A'])
if (changed()) {
  console.log('2/5  committing source')
  run('git', ['commit', '-q', '-m', 'NEBULA X1 — cinematic scroll-driven product experience'])
} else {
  console.log('2/5  nothing new to commit')
}

/* ----------------------------------------------------------- 3. publish dist */

// A detached worktree keeps the built output out of the source history
// entirely. Starting from an orphan branch — one with no parent commit — means
// the published branch contains exactly one commit holding exactly the built
// files, which is what Pages serves from the site root.
const WORKTREE = '.deploy-worktree'
if (existsSync(WORKTREE)) {
  try {
    run('git', ['worktree', 'remove', '--force', WORKTREE], { stdio: 'ignore' })
  } catch {
    /* not registered */
  }
}

console.log(`3/5  publishing build output to ${BRANCH}`)
run('git', ['worktree', 'add', '--detach', WORKTREE, 'HEAD'], { stdio: 'ignore' })
try {
  run('git', ['-C', WORKTREE, 'checkout', '--orphan', BRANCH], { stdio: 'ignore' })

  // Clear the worktree's working directory, then place the build output at its
  // root so the site is served from `/` rather than from `/dist/`.
  for (const entry of readdirSync(WORKTREE)) {
    if (entry === '.git') continue
    rmSync(path.join(WORKTREE, entry), { recursive: true, force: true })
  }
  cpSync('dist', WORKTREE, { recursive: true })

  run('git', ['-C', WORKTREE, 'add', '-A', '-f'])
  run('git', ['-C', WORKTREE, 'commit', '-q', '-m', `Deploy ${new Date().toISOString()}`])
  run('git', ['-C', WORKTREE, 'push', '--force', 'origin', `${BRANCH}:${BRANCH}`])
} finally {
  try {
    rmSync(WORKTREE, { recursive: true, force: true })
    run('git', ['worktree', 'prune'], { stdio: 'ignore' })
  } catch {
    /* already gone */
  }
}

/* --------------------------------------------------------------- 4. repo */

if (!hasRepo()) {
  console.log('4/5  creating public repository')
  run('gh', [
    'repo',
    'create',
    REPO,
    '--public',
    '--source',
    '.',
    '--remote',
    'origin',
    '--description',
    'NEBULA X1 — a cinematic, scroll-driven WebGL product experience for a fictional electric hyperbike.',
    '--push',
  ])
} else {
  console.log('4/5  pushing source')
  if (!capture('git', ['remote']).split('\n').includes('origin')) {
    run('git', ['remote', 'add', 'origin', `https://github.com/${USER}/${REPO}.git`])
  }
  run('git', ['push', '-q', '-u', 'origin', 'main', '--force'])
}

/* -------------------------------------------------------------- 5. pages */

console.log('5/5  enabling GitHub Pages')
try {
  execFileSync(
    'gh',
    [
      'api',
      '--method',
      'POST',
      `repos/${USER}/${REPO}/pages`,
      '-f',
      `source[branch]=${BRANCH}`,
      '-f',
      'source[path]=/',
    ],
    { stdio: 'ignore' },
  )
} catch {
  // Already enabled on a re-deploy, which is fine.
  execFileSync(
    'gh',
    [
      'api',
      '--method',
      'PUT',
      `repos/${USER}/${REPO}/pages`,
      '-f',
      `source[branch]=${BRANCH}`,
      '-f',
      'source[path]=/',
    ],
    { stdio: 'ignore' },
  )
}

/* ------------------------------------------------------------- wait for it */

process.stdout.write('     waiting for the site to serve')
let live = false
for (let i = 0; i < 60; i++) {
  await sleep(6000)
  process.stdout.write('.')
  try {
    const res = await fetch(SITE, { redirect: 'follow' })
    if (!res.ok) continue
    const body = await res.text()
    if (body.includes(`${BASE}assets/`)) {
      live = true
      break
    }
  } catch {
    /* not up yet */
  }
}
process.stdout.write('\n')

if (live) {
  console.log(`\n  live:  ${SITE}\n`)
} else {
  console.log(
    `\n  published, but the first Pages build is still running.\n  Check again in a minute:  ${SITE}\n`,
  )
}
