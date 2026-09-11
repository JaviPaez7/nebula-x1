import * as THREE from 'three'

/**
 * Shared "authoring" channels.
 *
 * Every surface in the machine drives its reveal, its forced-emission and its
 * preview highlight from the same `uReveal` uniforms, so a single animated
 * value sweeps the whole bike at once — front wheel to tail. That is what
 * makes chapter 02 feel like one continuous strip of light travelling across
 * the body rather than a set of independent part animations.
 */
const shared = {
  uReveal: { value: -10 } as THREE.IUniform<number>,
  uRevealWidth: { value: 0.3 } as THREE.IUniform<number>,
  uRevealGlow: { value: 0.45 } as THREE.IUniform<number>,
  uGlow: { value: 0 } as THREE.IUniform<number>,
}

export const materialChannels = shared

export function setReveal(lead: number, width = 0.3, glow = 0.45) {
  shared.uReveal.value = lead
  shared.uRevealWidth.value = width
  shared.uRevealGlow.value = glow
}

export function setGlobalGlow(g: number) {
  shared.uGlow.value = g
}

/**
 * Injects the reveal sweep into a MeshStandardMaterial's fragment shader.
 * Because it runs against the *world* position of the fragment, the sweep is
 * a genuine plane of light moving through space — it wraps the silhouette
 * correctly no matter how the part is transformed (including exploded views).
 */
function patchShader(mat: THREE.MeshStandardMaterial) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uReveal = shared.uReveal
    shader.uniforms.uRevealWidth = shared.uRevealWidth
    shader.uniforms.uRevealGlow = shared.uRevealGlow
    shader.uniforms.uGlow = shared.uGlow

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aRevealOffset;
        uniform float uReveal;
        varying vec3 vRevealWorld;
        varying float vRevealAt;`,
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        // Deliberately the pre-modelMatrix (mesh-local) position: the sweep is
        // authored in the machine's own coordinate space, so it stays glued to
        // the bike no matter how the rig rotates or explodes.
        vRevealWorld = transformed;
        vRevealAt = uReveal - aRevealOffset;`,
      )

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vRevealWorld;
        varying float vRevealAt;
        uniform float uRevealWidth;
        uniform float uRevealGlow;
        uniform float uGlow;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          float swept = 1.0 - smoothstep(vRevealAt - uRevealWidth, vRevealAt, vRevealWorld.z);
          float bandWidth = max(uRevealWidth * 0.85, 0.018);
          float band = 1.0 - smoothstep(0.0, bandWidth, abs(vRevealWorld.z - vRevealAt));
          float heat = pow(band, 1.5) * uRevealGlow * 3.6 + uGlow;
          // Cold electric-white strip, hottest right at the leading edge.
          vec3 stripColor = mix(vec3(0.38, 0.7, 1.0), vec3(0.92, 0.98, 1.0), band);
          totalEmissiveRadiance += stripColor * heat;
          // Revealed surfaces sit in a slightly brighter pool of light, as if
          // the strip is illuminating what it just uncovered.
          totalEmissiveRadiance += diffuseColor.rgb * swept * uRevealGlow * 0.08;
        }`,
      )
  }
}

export type MaterialSpec = {
  color?: THREE.ColorRepresentation
  metalness?: number
  roughness?: number
  map?: THREE.Texture | null
  roughnessMap?: THREE.Texture | null
  normalMap?: THREE.Texture | null
  normalScale?: THREE.Vector2
  emissive?: THREE.ColorRepresentation
  emissiveIntensity?: number
  envMapIntensity?: number
  clearcoat?: number
  clearcoatRoughness?: number
  transparent?: boolean
  opacity?: number
  side?: THREE.Side
  depthWrite?: boolean
  flatShading?: boolean
  /** skip the reveal sweep (used for lens glass and light bars) */
  noReveal?: boolean
}

/** Build a standard material with the reveal sweep patched in. */
export function buildMaterial(spec: MaterialSpec): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: spec.color ?? 0xffffff,
    metalness: spec.metalness ?? 0,
    roughness: spec.roughness ?? 0.5,
    map: spec.map ?? null,
    roughnessMap: spec.roughnessMap ?? null,
    normalMap: spec.normalMap ?? null,
    emissive: spec.emissive ?? 0x000000,
    emissiveIntensity: spec.emissiveIntensity ?? 1,
    envMapIntensity: spec.envMapIntensity ?? 1,
    transparent: spec.transparent ?? false,
    opacity: spec.opacity ?? 1,
    side: spec.side ?? THREE.FrontSide,
    depthWrite: spec.depthWrite ?? true,
    flatShading: spec.flatShading ?? false,
  })
  if (spec.normalScale) mat.normalScale.copy(spec.normalScale)
  if (!spec.noReveal) patchShader(mat)
  mat.customProgramCacheKey = () => (spec.noReveal ? 'nr' : 'reveal')
  return mat
}
