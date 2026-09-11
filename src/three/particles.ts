import * as THREE from 'three'
import type { Quality } from './Bike'

/**
 * Particle systems.
 *
 * Three systems share one idea: they are all pure GPU loops driven by a couple
 * of uniforms, so scroll speed can intensify them without any CPU cost. Nothing
 * here allocates per frame.
 */

/* ------------------------------------------------------------- airflow */

const airflowVert = /* glsl */ `
  attribute float aOffset;
  attribute float aSeed;
  attribute float aSide;
  uniform float uTime;
  uniform float uIntensity;
  uniform float uSpeed;
  uniform vec3 uBikeCenter;
  varying float vFade;
  varying float vSide;

  void main() {
    float z = position.z;
    float x = position.x;
    float y = position.y;

    // Advect along +Z (air travelling from the front of the machine to the
    // back) and wrap. uSpeed is fed by scroll velocity, so scrolling faster
    // literally makes the air move faster.
    float span = 7.2;
    float travel = mod(uTime * uSpeed + aOffset * span, span);
    float zz = -span * 0.5 + travel + z * 0.0;

    // Streamline deflection: air cannot pass through the machine, so the flow
    // spreads around a virtual body and the vertical component is driven by
    // the local displacement.
    float dx = x - uBikeCenter.x;
    float dy = y - uBikeCenter.y;
    float dist = length(vec2(dx, dy)) + 0.28;
    float body = 0.62 / (dist * dist);

    vec3 p;
    p.x = x + (dx / dist) * body * 0.85 * uIntensity - aSide * 0.0;
    p.y = y + (dy / dist) * body * 0.55 * uIntensity;
    p.z = zz;

    // Turbulence wake behind the machine.
    float wake = smoothstep(0.6, -1.5, p.z) * smoothstep(-0.9, -2.4, p.z);
    float t = uTime * 1.7 + aSeed * 26.0;
    p.x += sin(t) * 0.055 * wake * uIntensity;
    p.y += cos(t * 1.31) * 0.05 * wake * uIntensity;

    // Fade in upstream, brightest as air is squeezed over the body, out in the wake.
    float near = 1.0 - smoothstep(0.0, 2.6, abs(p.z - uBikeCenter.z));
    vFade = (0.16 + 0.84 * near) * uIntensity;
    vFade *= 0.55 + 0.45 * smoothstep(0.15, 0.5, dist * 0.9);
    vSide = aSide;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = 0.0;
  }
`

const airflowFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vFade;
  varying float vSide;
  void main() {
    float a = vFade * uOpacity;
    if (a <= 0.001) discard;
    gl_FragColor = vec4(uColor * (0.7 + 0.3 * abs(vSide)), a);
  }
`

export type AirflowRig = {
  mesh: THREE.LineSegments
  material: THREE.ShaderMaterial
  set: (intensity: number, speed: number) => void
  update: (t: number) => void
}

/**
 * Streamlines around the machine. Line segments rather than points because the
 * eye reads direction from a streak far more convincingly than from a dot.
 */
export function createAirflow(quality: Quality): AirflowRig {
  const count = Math.round(2600 * quality.particleScale)
  const positions = new Float32Array(count * 2 * 3)
  const offsets = new Float32Array(count * 2)
  const seeds = new Float32Array(count * 2)
  const sides = new Float32Array(count * 2)

  for (let i = 0; i < count; i++) {
    const u = Math.random()
    // bias density toward the machine
    const bell = (Math.random() + Math.random() + Math.random()) / 3 - 0.5
    const ang = Math.random() * Math.PI * 2
    const radial = Math.abs(bell) * 2.9 + 0.22
    const x = Math.cos(ang) * radial
    const y = 0.58 + Math.sin(ang) * radial * 0.72
    const z = (u - 0.5) * 7.0
    const seed = Math.random()
    const off = Math.random()
    const side = Math.sign(x) || 1

    const base = i * 6
    positions[base] = x
    positions[base + 1] = y
    positions[base + 2] = z
    positions[base + 3] = x
    positions[base + 4] = y
    positions[base + 5] = z
    offsets[i * 2] = off
    offsets[i * 2 + 1] = off
    seeds[i * 2] = seed
    seeds[i * 2 + 1] = seed
    sides[i * 2] = side
    sides[i * 2 + 1] = side
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 1))
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
  geo.setAttribute('aSide', new THREE.BufferAttribute(sides, 1))
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.6, 0), 8)

  const material = new THREE.ShaderMaterial({
    vertexShader: airflowVert,
    fragmentShader: airflowFrag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0 },
      uSpeed: { value: 1.4 },
      uBikeCenter: { value: new THREE.Vector3(0, 0.6, 0) },
      uColor: { value: new THREE.Color(0x8ec4ff) },
      uOpacity: { value: 0.5 },
    },
  })

  const mesh = new THREE.LineSegments(geo, material)
  mesh.frustumCulled = false
  mesh.renderOrder = 4

  return {
    mesh,
    material,
    set(intensity, speed) {
      material.uniforms.uIntensity.value = intensity
      material.uniforms.uSpeed.value = speed
      material.uniforms.uOpacity.value = 0.14 + 0.5 * intensity
    },
    update(t) {
      material.uniforms.uTime.value = t
    },
  }
}

/* ---------------------------------------------------------- energy cells */

const energyVert = /* glsl */ `
  attribute float aSeed;
  attribute float aTrack;
  uniform float uTime;
  uniform float uPower;
  varying float vGlow;
  void main() {
    float cycle = fract(uTime * (0.18 + aSeed * 0.5) + aSeed * 7.3);
    vec3 p = position;
    // energy climbs the module stack and runs along the busbars
    p.y += cycle * (0.34 + aTrack * 0.4) - 0.05;
    p.z += sin(cycle * 6.2831 + aSeed * 12.0) * 0.012;

    float pulse = smoothstep(0.0, 0.14, cycle) * (1.0 - smoothstep(0.72, 1.0, cycle));
    vGlow = pulse * uPower;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    // Perspective-correct point size with a hard ceiling. Without the clamp a
    // single particle passing close to the lens becomes a screen-filling blob.
    float dist = max(0.5, -mv.z);
    gl_PointSize = clamp((0.4 + 1.8 * pulse) * uPower * (14.0 / dist), 0.0, 5.0);
  }
`

const energyFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uPower;
  varying float vGlow;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float core = 1.0 - smoothstep(0.0, 0.18, d);
    float halo = 1.0 - smoothstep(0.05, 0.5, d);
    float a = (core * 0.55 + halo * 0.3) * vGlow * uPower;
    gl_FragColor = vec4(mix(uColor, vec3(1.0), core * 0.65), a);
  }
`

export type EnergyRig = {
  points: THREE.Points
  material: THREE.ShaderMaterial
  group: THREE.Group
  set: (power: number) => void
  update: (t: number) => void
}

/**
 * Energy moving through the battery modules: a dense point field confined to
 * the pack envelope, climbing the stack on a looping cycle.
 */
export function createEnergyCells(quality: Quality): EnergyRig {
  const count = Math.round(900 * quality.particleScale)
  const pos = new Float32Array(count * 3)
  const seed = new Float32Array(count)
  const track = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const col = Math.floor(Math.random() * 6)
    const row = Math.random() < 0.5 ? -1 : 1
    pos[i * 3] = row * 0.088 + (Math.random() - 0.5) * 0.13
    pos[i * 3 + 1] = 0.14 + (Math.random() - 0.5) * 0.24
    pos[i * 3 + 2] = -0.27 + col * 0.104 + (Math.random() - 0.5) * 0.08
    seed[i] = Math.random()
    track[i] = Math.random()
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
  geo.setAttribute('aTrack', new THREE.BufferAttribute(track, 1))
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.14, 0), 0.8)

  const material = new THREE.ShaderMaterial({
    vertexShader: energyVert,
    fragmentShader: energyFrag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPower: { value: 0 },
      uColor: { value: new THREE.Color(0x5fc6ff) },
    },
  })

  const points = new THREE.Points(geo, material)
  points.frustumCulled = false
  points.renderOrder = 6

  const group = new THREE.Group()
  group.position.set(0, 0.54, 0.03)
  group.add(points)

  return {
    points,
    material,
    group,
    set(power) {
      material.uniforms.uPower.value = power
      points.visible = power > 0.01
    },
    update(t) {
      material.uniforms.uTime.value = t
    },
  }
}

/* ------------------------------------------------------------- road dust */

const dustVert = /* glsl */ `
  attribute float aSeed;
  attribute float aSize;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uSpread;
  varying float vFade;
  void main() {
    vec3 p = position;
    // streaks rush past the camera along -Z, the direction of travel
    float span = 46.0;
    float t = mod(uTime * uSpeed * (0.6 + aSeed) + aSeed * span, span);
    p.z = 8.0 - t;
    p.x += sin(uTime * 0.6 + aSeed * 20.0) * uSpread * (0.3 + aSeed);
    p.y += cos(uTime * 0.5 + aSeed * 14.0) * 0.1 * uSpread;
    vFade = smoothstep(8.0, 2.0, p.z) * smoothstep(-38.0, -14.0, p.z) * uSpeed;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    // Dust only reads as dust if it stays small: a hard ceiling keeps stray
    // motes from becoming foreground blobs as they rush past the lens.
    float dist = max(1.2, -mv.z);
    gl_PointSize = clamp(aSize * (46.0 / dist), 0.0, 9.0);
  }
`

const dustFrag = /* glsl */ `
  uniform vec3 uColor;
  varying float vFade;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float a = (1.0 - smoothstep(0.0, 0.5, d)) * vFade * 0.55;
    gl_FragColor = vec4(uColor, a);
  }
`

export type DustRig = {
  points: THREE.Points
  material: THREE.ShaderMaterial
  set: (speed: number, spread: number) => void
  update: (t: number) => void
}

/** Airborne dust thrown up by the machine at speed. */
export function createRoadDust(quality: Quality): DustRig {
  const count = Math.round(900 * quality.particleScale)
  const pos = new Float32Array(count * 3)
  const seed = new Float32Array(count)
  const size = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 9
    pos[i * 3 + 1] = Math.random() * 2.2 - 0.1
    pos[i * 3 + 2] = (Math.random() - 0.5) * 46
    seed[i] = Math.random()
    size[i] = 0.4 + Math.random() * 1.6
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 30)

  const material = new THREE.ShaderMaterial({
    vertexShader: dustVert,
    fragmentShader: dustFrag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uSpeed: { value: 0 },
      uSpread: { value: 0.25 },
      uColor: { value: new THREE.Color(0x9fb6cc) },
    },
  })

  const points = new THREE.Points(geo, material)
  points.frustumCulled = false
  points.renderOrder = 5

  return {
    points,
    material,
    set(speed, spread) {
      material.uniforms.uSpeed.value = speed
      material.uniforms.uSpread.value = spread
      points.visible = speed > 0.01
    },
    update(t) {
      material.uniforms.uTime.value = t
    },
  }
}
