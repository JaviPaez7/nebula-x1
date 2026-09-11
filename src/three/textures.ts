import * as THREE from 'three'

/**
 * Procedurally generated texture library.
 *
 * Everything the machine is made of is drawn into offscreen canvases at boot
 * so the experience ships with zero binary assets: no download stalls, no
 * licence questions, and full control over the surface language.
 */

const cache = new Map<string, THREE.Texture>()

function canvas(size: number) {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  return c
}

function finish(c: HTMLCanvasElement, repeat = 1, srgb = false): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeat, repeat)
  tex.anisotropy = 4
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

function memo(key: string, make: () => THREE.CanvasTexture) {
  const hit = cache.get(key)
  if (hit) return hit
  const tex = make()
  cache.set(key, tex)
  return tex
}

/* ------------------------------------------------------------------ noise */

/** Small value-noise helper so the textures have believable micro variation. */
function makeNoise(seed = 1) {
  const size = 128
  const grid = new Float32Array(size * size)
  let s = seed
  const rnd = () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
  for (let i = 0; i < grid.length; i++) grid[i] = rnd()
  const at = (x: number, y: number) => grid[(y & (size - 1)) * size + (x & (size - 1))]
  const smooth = (t: number) => t * t * (3 - 2 * t)
  return (x: number, y: number) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = smooth(x - xi)
    const yf = smooth(y - yi)
    const a = at(xi, yi)
    const b = at(xi + 1, yi)
    const c = at(xi, yi + 1)
    const d = at(xi + 1, yi + 1)
    return (a * (1 - xf) + b * xf) * (1 - yf) + (c * (1 - xf) + d * xf) * yf
  }
}

function fbm(noise: (x: number, y: number) => number, x: number, y: number, octaves = 4) {
  let v = 0
  let amp = 0.5
  let f = 1
  for (let i = 0; i < octaves; i++) {
    v += noise(x * f, y * f) * amp
    amp *= 0.5
    f *= 2
  }
  return v
}

/* ---------------------------------------------------------------- carbon */

/**
 * 2x2 twill carbon weave — the signature diagonal checkerboard of a real
 * prepreg laminate. Used as both roughness and normal variation.
 */
export const carbonWeaveTexture = (repeat = 1) =>
  memo(`carbon-${repeat}`, () => {
    const S = 512
    const c = canvas(S)
    const ctx = c.getContext('2d')!
    const cell = S / 16
    ctx.fillStyle = '#181a1e'
    ctx.fillRect(0, 0, S, S)

    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const over = (x + y) % 2 === 0
        // Alternating warp / weft tows, lit from the upper left.
        const g = ctx.createLinearGradient(x * cell, y * cell, (x + 1) * cell, (y + 1) * cell)
        if (over) {
          g.addColorStop(0, '#3c4149')
          g.addColorStop(0.45, '#22262c')
          g.addColorStop(1, '#141619')
        } else {
          g.addColorStop(0, '#2a2e34')
          g.addColorStop(0.5, '#171a1e')
          g.addColorStop(1, '#0d0f11')
        }
        ctx.fillStyle = g
        ctx.fillRect(x * cell, y * cell, cell, cell)

        // Filament striations inside each tow.
        ctx.save()
        ctx.beginPath()
        ctx.rect(x * cell, y * cell, cell, cell)
        ctx.clip()
        ctx.globalAlpha = 0.22
        for (let i = 0; i < 7; i++) {
          const t = (i + 0.5) / 7
          ctx.strokeStyle = over ? '#5a616b' : '#454b54'
          ctx.lineWidth = cell * 0.035
          ctx.beginPath()
          if (over) {
            ctx.moveTo(x * cell + t * cell, y * cell)
            ctx.lineTo(x * cell + t * cell, (y + 1) * cell)
          } else {
            ctx.moveTo(x * cell, y * cell + t * cell)
            ctx.lineTo((x + 1) * cell, y * cell + t * cell)
          }
          ctx.stroke()
        }
        ctx.restore()
      }
    }
    return finish(c, repeat, true)
  })

/** Roughness companion for the weave: resin pools are glossier than tow crests. */
export const carbonRoughnessTexture = (repeat = 1) =>
  memo(`carbon-r-${repeat}`, () => {
    const S = 256
    const c = canvas(S)
    const ctx = c.getContext('2d')!
    const cell = S / 16
    ctx.fillStyle = '#4a4a4a'
    ctx.fillRect(0, 0, S, S)
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const over = (x + y) % 2 === 0
        const g = ctx.createLinearGradient(x * cell, y * cell, (x + 1) * cell, (y + 1) * cell)
        g.addColorStop(0, over ? '#6e6e6e' : '#5a5a5a')
        g.addColorStop(1, over ? '#2e2e2e' : '#3a3a3a')
        ctx.fillStyle = g
        ctx.fillRect(x * cell, y * cell, cell, cell)
      }
    }
    return finish(c, repeat)
  })

/* ------------------------------------------------------------- aluminium */

/** CNC-machined aluminium: fine concentric tool marks plus subtle blotching. */
export const machinedAluminiumTexture = (repeat = 2, colour = '#9aa2ab') =>
  memo(`alu-${repeat}-${colour}`, () => {
    const S = 512
    const c = canvas(S)
    const ctx = c.getContext('2d')!
    ctx.fillStyle = colour
    ctx.fillRect(0, 0, S, S)

    const n = makeNoise(7)
    const img = ctx.getImageData(0, 0, S, S)
    const d = img.data
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const i = (y * S + x) * 4
        const v = (fbm(n, x / 26, y / 26, 4) - 0.5) * 26
        const tool = Math.sin(y * 1.15) * 4 + Math.sin(x * 0.31) * 2
        d[i] = Math.max(0, Math.min(255, d[i] + v + tool))
        d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + v + tool))
        d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + v + tool))
      }
    }
    ctx.putImageData(img, 0, 0)
    return finish(c, repeat, true)
  })

/** Roughness map for machined metal — tool marks break up the highlight. */
export const machinedRoughnessTexture = (repeat = 2, base = 78) =>
  memo(`alu-r-${repeat}-${base}`, () => {
    const S = 256
    const c = canvas(S)
    const ctx = c.getContext('2d')!
    ctx.fillStyle = `rgb(${base},${base},${base})`
    ctx.fillRect(0, 0, S, S)
    const n = makeNoise(19)
    const img = ctx.getImageData(0, 0, S, S)
    const d = img.data
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const i = (y * S + x) * 4
        const v = (fbm(n, x / 40, y / 40, 3) - 0.5) * 34 + Math.sin(y * 1.15) * 6
        const val = Math.max(4, Math.min(255, d[i] + v))
        d[i] = d[i + 1] = d[i + 2] = val
      }
    }
    ctx.putImageData(img, 0, 0)
    return finish(c, repeat)
  })

/* ------------------------------------------------------------------ rubber */

/** Tyre rubber with a faint mould-release sheen and micro grain. */
export const rubberTexture = (repeat = 3) =>
  memo(`rubber-${repeat}`, () => {
    const S = 256
    const c = canvas(S)
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#0e0f11'
    ctx.fillRect(0, 0, S, S)
    const n = makeNoise(31)
    const img = ctx.getImageData(0, 0, S, S)
    const d = img.data
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const i = (y * S + x) * 4
        const v = (fbm(n, x / 8, y / 8, 3) - 0.5) * 22
        d[i] = Math.max(0, d[i] + v)
        d[i + 1] = Math.max(0, d[i + 1] + v)
        d[i + 2] = Math.max(0, d[i + 2] + v)
      }
    }
    ctx.putImageData(img, 0, 0)
    return finish(c, repeat, true)
  })

/* ------------------------------------------------------------------ glass */

/** A faint anti-reflective coating shimmer for lenses and screens. */
export const coatingTexture = (repeat = 1) =>
  memo(`coating-${repeat}`, () => {
    const S = 256
    const c = canvas(S)
    const ctx = c.getContext('2d')!
    const g = ctx.createRadialGradient(S * 0.4, S * 0.35, 0, S * 0.5, S * 0.5, S * 0.75)
    g.addColorStop(0, '#ffffff')
    g.addColorStop(0.45, '#8fa8c4')
    g.addColorStop(1, '#20262e')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, S, S)
    return finish(c, repeat, true)
  })

/* --------------------------------------------------------------- battery */

/** Cell array faceplate: busbars, foil pouches, terminal pips. */
export const batteryCellTexture = (cols = 8, rows = 4) =>
  memo(`cell-${cols}-${rows}`, () => {
    const S = 512
    const c = canvas(S)
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#0b0d10'
    ctx.fillRect(0, 0, S, S)
    const cw = S / cols
    const ch = S / rows
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const px = x * cw + cw * 0.08
        const py = y * ch + ch * 0.12
        const pw = cw * 0.84
        const ph = ch * 0.76
        const g = ctx.createLinearGradient(px, py, px + pw, py + ph)
        g.addColorStop(0, '#2b3138')
        g.addColorStop(0.5, '#1a1e23')
        g.addColorStop(1, '#0f1215')
        ctx.fillStyle = g
        ctx.fillRect(px, py, pw, ph)
        ctx.strokeStyle = '#3d444d'
        ctx.lineWidth = 1.5
        ctx.strokeRect(px, py, pw, ph)
        // terminal pips
        ctx.fillStyle = '#5d666f'
        ctx.fillRect(px + pw * 0.12, py + ph * 0.16, pw * 0.1, ph * 0.16)
        ctx.fillRect(px + pw * 0.78, py + ph * 0.68, pw * 0.1, ph * 0.16)
      }
    }
    // copper busbar ribbons
    ctx.strokeStyle = 'rgba(196,124,74,0.5)'
    ctx.lineWidth = 3
    for (let y = 0; y <= rows; y++) {
      ctx.beginPath()
      ctx.moveTo(0, y * ch)
      ctx.lineTo(S, y * ch)
      ctx.stroke()
    }
    return finish(c, 1, true)
  })

/* ------------------------------------------------------------ anisotropy */

/**
 * A brushed / brushed-metal streak map usable as an anisotropy-style detail
 * on the top coat of raw aluminium parts.
 */
export const brushedTexture = (repeat = 4) =>
  memo(`brushed-${repeat}`, () => {
    const S = 256
    const c = canvas(S)
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#808080'
    ctx.fillRect(0, 0, S, S)
    const n = makeNoise(53)
    const img = ctx.getImageData(0, 0, S, S)
    const d = img.data
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const i = (y * S + x) * 4
        const v = (n(x * 0.08, y * 4.2) - 0.5) * 90
        const val = Math.max(0, Math.min(255, d[i] + v))
        d[i] = d[i + 1] = d[i + 2] = val
      }
    }
    ctx.putImageData(img, 0, 0)
    return finish(c, repeat)
  })

/* --------------------------------------------------------------- studio */

/** Soft studio gradient used by the environment probe. */
export const studioGradientTexture = () =>
  memo('studio-grad', () => {
    const S = 256
    const c = canvas(S)
    const ctx = c.getContext('2d')!
    const g = ctx.createLinearGradient(0, 0, 0, S)
    g.addColorStop(0, '#0a0c10')
    g.addColorStop(0.42, '#2c333c')
    g.addColorStop(0.55, '#454e59')
    g.addColorStop(0.72, '#161a1f')
    g.addColorStop(1, '#05060a')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, S, S)
    return finish(c, 1, true)
  })

/* ---------------------------------------------------------------- ground */

/** Infinitely tiling dark studio floor with a faint machined grid. */
export const studioFloorTexture = (repeat = 24) =>
  memo(`floor-${repeat}`, () => {
    const S = 256
    const c = canvas(S)
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#0a0b0e'
    ctx.fillRect(0, 0, S, S)
    ctx.strokeStyle = 'rgba(120,136,152,0.09)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const p = (i / 4) * S
      ctx.beginPath()
      ctx.moveTo(p, 0)
      ctx.lineTo(p, S)
      ctx.moveTo(0, p)
      ctx.lineTo(S, p)
      ctx.stroke()
    }
    const n = makeNoise(97)
    const img = ctx.getImageData(0, 0, S, S)
    const d = img.data
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const i = (y * S + x) * 4
        const v = (fbm(n, x / 18, y / 18, 3) - 0.5) * 10
        d[i] = Math.max(0, d[i] + v)
        d[i + 1] = Math.max(0, d[i + 1] + v)
        d[i + 2] = Math.max(0, d[i + 2] + v)
      }
    }
    ctx.putImageData(img, 0, 0)
    return finish(c, repeat, true)
  })

/** Ringed roughness so the floor reads as polished concrete, not a mirror. */
export const studioFloorRoughness = (repeat = 24) =>
  memo(`floor-r-${repeat}`, () => {
    const S = 128
    const c = canvas(S)
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#3c3c3c'
    ctx.fillRect(0, 0, S, S)
    const n = makeNoise(131)
    const img = ctx.getImageData(0, 0, S, S)
    const d = img.data
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const i = (y * S + x) * 4
        const v = (fbm(n, x / 14, y / 14, 2) - 0.5) * 40
        const val = Math.max(8, Math.min(255, d[i] + v))
        d[i] = d[i + 1] = d[i + 2] = val
      }
    }
    ctx.putImageData(img, 0, 0)
    return finish(c, repeat)
  })

/** Pre-generate the heavy ones so the loading screen reports real work. */
export function buildTextureLibrary() {
  const out = {
    carbon: carbonWeaveTexture(1),
    carbonRough: carbonRoughnessTexture(1),
    alu: machinedAluminiumTexture(1),
    aluRough: machinedRoughnessTexture(1),
    titanium: machinedAluminiumTexture(1, '#7d848c'),
    titaniumRough: machinedRoughnessTexture(1, 96),
    rubber: rubberTexture(1),
    coating: coatingTexture(1),
    cells: batteryCellTexture(),
    brushed: brushedTexture(1),
    floor: studioFloorTexture(),
    floorRough: studioFloorRoughness(),
  }
  return out
}

export type TextureLibrary = ReturnType<typeof buildTextureLibrary>

export function disposeTextureLibrary() {
  for (const t of cache.values()) t.dispose()
  cache.clear()
}
