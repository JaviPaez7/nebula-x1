import * as THREE from 'three'
import { buildMaterial, type MaterialSpec } from './materials'
import type { TextureLibrary } from './textures'

/**
 * The NEBULA X1 materials palette.
 *
 * A deliberately narrow, industrial set: prepreg carbon, machined 7075
 * aluminium, titanium, hard-anodised black, rubber and cold LED light. No
 * decorative colour anywhere — the only saturated values in the entire film
 * come from light itself.
 */
export type BikeMaterials = {
  carbon: THREE.MeshStandardMaterial
  carbonPanel: THREE.MeshStandardMaterial
  carbonMatte: THREE.MeshStandardMaterial
  aluminium: THREE.MeshStandardMaterial
  aluminiumDark: THREE.MeshStandardMaterial
  titanium: THREE.MeshStandardMaterial
  anodised: THREE.MeshStandardMaterial
  structural: THREE.MeshStandardMaterial
  rubber: THREE.MeshStandardMaterial
  rubberSoft: THREE.MeshStandardMaterial
  glass: THREE.MeshStandardMaterial
  lens: THREE.MeshStandardMaterial
  copper: THREE.MeshStandardMaterial
  brakeDisc: THREE.MeshStandardMaterial
  screen: THREE.MeshStandardMaterial
  headlightLED: THREE.MeshStandardMaterial
  tailLED: THREE.MeshStandardMaterial
  accentLED: THREE.MeshStandardMaterial
  cells: THREE.MeshStandardMaterial
  raw: THREE.MeshStandardMaterial
}

const specs = (tex: TextureLibrary): Record<keyof BikeMaterials, MaterialSpec> => ({
  /** Exposed structural carbon: visible twill, deep clearcoat. */
  carbon: {
    color: 0x2a2e34,
    metalness: 0.14,
    roughness: 0.34,
    map: tex.carbon,
    roughnessMap: tex.carbonRough,
    normalMap: tex.carbon,
    normalScale: new THREE.Vector2(0.55, 0.55),
    envMapIntensity: 1.35,
  },
  /** Bodywork: same laminate, but lacquered to a glassier finish. */
  carbonPanel: {
    color: 0x3a3f47,
    metalness: 0.16,
    roughness: 0.3,
    map: tex.carbon,
    roughnessMap: tex.carbonRough,
    normalMap: tex.carbon,
    normalScale: new THREE.Vector2(0.3, 0.3),
    envMapIntensity: 1.9,
  },
  /** Frame and battery enclosure: a dry, matte laminate. */
  carbonMatte: {
    color: 0x22262c,
    metalness: 0.1,
    roughness: 0.58,
    map: tex.carbon,
    roughnessMap: tex.carbonRough,
    normalMap: tex.carbon,
    normalScale: new THREE.Vector2(0.8, 0.8),
    envMapIntensity: 1.0,
  },
  /** Bright machined 7075 — the hero metal of the machine. */
  aluminium: {
    color: 0xb9c0c8,
    metalness: 1,
    roughness: 0.24,
    map: tex.alu,
    roughnessMap: tex.aluRough,
    envMapIntensity: 2.1,
  },
  /** Bead-blasted and anodised: the darker structural aluminium. */
  aluminiumDark: {
    color: 0x6d757e,
    metalness: 0.88,
    roughness: 0.44,
    map: tex.alu,
    roughnessMap: tex.aluRough,
    envMapIntensity: 1.5,
  },
  titanium: {
    color: 0x8f979f,
    metalness: 1,
    roughness: 0.31,
    map: tex.titanium,
    roughnessMap: tex.titaniumRough,
    envMapIntensity: 1.85,
  },
  /** Hard-anodised black hardware: bolts, clamps, brackets. */
  anodised: {
    color: 0x2e333a,
    metalness: 0.72,
    roughness: 0.42,
    envMapIntensity: 1.2,
  },
  structural: {
    color: 0x24282e,
    metalness: 0.12,
    roughness: 0.72,
    envMapIntensity: 0.85,
  },
  rubber: {
    color: 0x1a1c21,
    metalness: 0.02,
    roughness: 0.88,
    map: tex.rubber,
    envMapIntensity: 0.55,
  },
  rubberSoft: {
    color: 0x24272d,
    metalness: 0,
    roughness: 0.97,
    map: tex.rubber,
    envMapIntensity: 0.4,
  },
  glass: {
    color: 0x0b0e12,
    metalness: 0.1,
    roughness: 0.04,
    envMapIntensity: 2.6,
    transparent: true,
    opacity: 0.55,
  },
  /** Optical-grade polycarbonate over the LED projector. */
  lens: {
    color: 0x0d1116,
    metalness: 0.24,
    roughness: 0.06,
    map: tex.coating,
    envMapIntensity: 3.0,
    transparent: true,
    opacity: 0.72,
    noReveal: true,
  },
  copper: {
    color: 0xb06a3c,
    metalness: 1,
    roughness: 0.36,
    envMapIntensity: 1.9,
  },
  brakeDisc: {
    color: 0x707880,
    metalness: 1,
    roughness: 0.34,
    map: tex.brushed,
    envMapIntensity: 1.6,
  },
  screen: {
    color: 0x05070a,
    metalness: 0.4,
    roughness: 0.1,
    emissive: 0x0a1622,
    emissiveIntensity: 0.4,
    envMapIntensity: 2.2,
  },
  headlightLED: {
    color: 0xdfeeff,
    metalness: 0.2,
    roughness: 0.25,
    emissive: 0xbfe0ff,
    emissiveIntensity: 1.2,
    noReveal: true,
  },
  tailLED: {
    color: 0x501018,
    metalness: 0.3,
    roughness: 0.3,
    emissive: 0xff2a3c,
    emissiveIntensity: 1.0,
    noReveal: true,
  },
  accentLED: {
    color: 0x9fd8ff,
    metalness: 0.2,
    roughness: 0.3,
    emissive: 0x6fc2ff,
    emissiveIntensity: 0.8,
    noReveal: true,
  },
  /** Battery module faceplate. */
  cells: {
    color: 0x6a747f,
    metalness: 0.82,
    roughness: 0.46,
    map: tex.cells,
    emissive: 0x08131f,
    emissiveIntensity: 1,
    envMapIntensity: 1.0,
  },
  /** Unpainted reference surface used by hidden internals. */
  raw: {
    color: 0x454b53,
    metalness: 0.6,
    roughness: 0.5,
    envMapIntensity: 1.2,
  },
})

export function createBikeMaterials(tex: TextureLibrary): BikeMaterials {
  const s = specs(tex)
  const out = {} as BikeMaterials
  for (const key of Object.keys(s) as (keyof BikeMaterials)[]) {
    out[key] = buildMaterial(s[key])
  }
  return out
}

export function disposeBikeMaterials(m: BikeMaterials) {
  for (const mat of Object.values(m)) mat.dispose()
}
