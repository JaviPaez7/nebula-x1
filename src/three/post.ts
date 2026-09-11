import * as THREE from 'three'
import type { Quality } from './Bike'

/**
 * A single full-screen grade pass.
 *
 * Rather than pulling in a post-processing framework for one effect, the scene
 * is drawn into a render target and composited through one shader that does
 * everything the film needs: edge vignette, a light anamorphic fringe, film
 * grain, and a radial smear that rises with scroll speed during the ride.
 * One extra draw call buys the whole look.
 *
 * The target is half-float and marked as having no colour space, because the
 * renderer writes linear pre-encode values into it. An 8-bit target quantises
 * a deliberately dark film into a handful of codes and crushes every shadow.
 */

const vert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const frag = /* glsl */ `
  precision highp float;
  uniform sampler2D tScene;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uVignette;
  uniform float uGrain;
  uniform float uAberration;
  uniform float uSpeedSmear;
  uniform float uExposure;
  uniform float uWarmth;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    vec2 centre = vUv - 0.5;
    float r2 = dot(centre, centre);

    // Radial smear: only meaningful while the ride is accelerating, and it
    // always points away from the frame centre so it reads as motion, not blur.
    vec3 col;
    if (uSpeedSmear > 0.001) {
      vec2 d = centre * uSpeedSmear * 0.055;
      col = texture2D(tScene, vUv).rgb * 0.4;
      col += texture2D(tScene, vUv + d * 0.35).rgb * 0.3;
      col += texture2D(tScene, vUv + d * 0.7).rgb * 0.2;
      col += texture2D(tScene, vUv + d).rgb * 0.1;
    } else {
      col = texture2D(tScene, vUv).rgb;
    }

    // Lateral chromatic fringe, strongest at the edges — a real lens artefact.
    float fringe = uAberration * (0.4 + r2 * 2.4) * 0.0022;
    col.r = texture2D(tScene, vUv + centre * fringe).r;
    col.b = texture2D(tScene, vUv - centre * fringe).b;

    // Vignette: a soft optical falloff toward the corners.
    col *= 1.0 - uVignette * smoothstep(0.16, 0.8, r2 * 1.5);

    // Gentle S-curve for contrast, pivoting around mid grey.
    col = clamp(col, 0.0, 1.5);
    col = mix(col, col * col * (3.0 - 2.0 * col), 0.26);

    // Colour temperature trim: cool shadows, neutral highlights.
    col *= mix(vec3(0.97, 0.99, 1.03), vec3(1.03, 1.0, 0.97), uWarmth);

    col *= uExposure;

    // Animated grain, scaled down in bright frames so it never looks noisy.
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    float grain = (hash(vUv * uResolution + fract(uTime) * 137.0) - 0.5) * uGrain;
    col += grain * (0.35 + 0.65 * (1.0 - smoothstep(0.0, 0.7, lum)));

    gl_FragColor = vec4(max(col, 0.0), 1.0);
  }
`

export type GradePass = {
  render: (renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) => void
  setSize: (w: number, h: number, dpr: number) => void
  uniforms: Record<string, THREE.IUniform>
  /** exposed for the development introspection hook */
  target: THREE.WebGLRenderTarget
  dispose: () => void
}

export function createGradePass(quality: Quality): GradePass {
  const target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    samples: quality.tier === 'high' ? 4 : 0,
    depthBuffer: true,
    stencilBuffer: false,
    generateMipmaps: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  })
  target.texture.colorSpace = THREE.NoColorSpace

  const uniforms: Record<string, THREE.IUniform> = {
    tScene: { value: target.texture },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uVignette: { value: 0.72 },
    uGrain: { value: 0.05 },
    uAberration: { value: 0.5 },
    uSpeedSmear: { value: 0 },
    uExposure: { value: 1 },
    uWarmth: { value: 0.4 },
  }

  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const material = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
  })
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
  quad.frustumCulled = false
  scene.add(quad)

  return {
    target,
    uniforms,
    setSize(w, h, dpr) {
      // The target must match the drawing buffer exactly: anything smaller and
      // the scene pass is silently rendered at a fraction of the resolution.
      target.setSize(Math.max(1, Math.round(w * dpr)), Math.max(1, Math.round(h * dpr)))
      uniforms.uResolution.value.set(w, h)
    },
    render(renderer, srcScene, srcCamera) {
      renderer.setRenderTarget(target)
      renderer.clear()
      renderer.render(srcScene, srcCamera)
      renderer.setRenderTarget(null)
      renderer.render(scene, camera)
    },
    dispose() {
      target.dispose()
      material.dispose()
      quad.geometry.dispose()
    },
  }
}
