import { useEffect, useMemo, useRef, type JSX } from 'react'
import * as THREE from 'three'
import { studioFloorRoughness, studioFloorTexture } from './textures'
import type { Quality } from './Bike'

/**
 * The studio.
 *
 * A cyclorama sphere with a vertical gradient provides the environment the
 * metal reflects, and a polished concrete plane gives the machine something to
 * sit on. Both are scroll-controlled: at the start of the film the room is
 * black, and it gradually acquires a horizon as the bike emerges.
 */

const backdropVert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const backdropFrag = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uBottom;
  uniform float uGlow;
  uniform float uHorizonY;
  uniform float uGlowSpread;
  varying vec3 vDir;

  void main() {
    float h = vDir.y;
    vec3 col = mix(uHorizon, uTop, smoothstep(uHorizonY, 0.85, h));
    col = mix(uBottom, col, smoothstep(-0.6, uHorizonY, h));
    // A soft pool of light behind the machine, as if a large softbox sits
    // just out of frame. It keeps the silhouette legible in the dark chapters.
    float behind = pow(max(0.0, 1.0 - abs(h - uHorizonY) / uGlowSpread), 2.4);
    float azimuth = pow(max(0.0, 1.0 - abs(atan(vDir.z, vDir.x) - 0.7) / 2.1), 2.0);
    col += uGlow * behind * (0.35 + 0.65 * azimuth) * vec3(0.32, 0.44, 0.6);
    // Dither to kill banding in the dark gradients — critical on OLED-ish panels.
    float d = fract(sin(dot(vDir.xz * 512.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
    gl_FragColor = vec4(col + d * 0.0035, 1.0);
  }
`

export function Backdrop({ quality }: { quality: Quality }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: backdropVert,
        fragmentShader: backdropFrag,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uTop: { value: new THREE.Color(0x05070b) },
          uHorizon: { value: new THREE.Color(0x0d1219) },
          uBottom: { value: new THREE.Color(0x020304) },
          uGlow: { value: 0 },
          uHorizonY: { value: 0.02 },
          uGlowSpread: { value: 0.55 },
        },
      }),
    [],
  )
  useEffect(() => () => mat.dispose(), [mat])
  return (
    <mesh material={mat} renderOrder={-10} frustumCulled={false} scale={[1, 1, 1]}>
      <sphereGeometry args={[26, quality.tier === 'low' ? 20 : 32, quality.tier === 'low' ? 14 : 24]} />
    </mesh>
  )
}

/**
 * Polished studio floor. A very large disc rather than an infinite plane so the
 * horizon line stays inside the frame and the vignette has something to fall on.
 */
export function Floor({ quality, receiveShadow }: { quality: Quality; receiveShadow: boolean }) {
  const { map, rough } = useMemo(() => {
    const repeat = quality.tier === 'high' ? 26 : 14
    return { map: studioFloorTexture(repeat), rough: studioFloorRoughness(repeat) }
  }, [quality.tier])

  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      color: 0x0c0e12,
      metalness: 0.12,
      roughness: 0.66,
      map,
      roughnessMap: rough,
      envMapIntensity: 0.35,
    })
    return m
  }, [map, rough])
  useEffect(() => () => mat.dispose(), [mat])

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]} receiveShadow={receiveShadow}>
      {/* A cylinder rather than a disc: the radial fan of a circle geometry has
          almost no triangles at its centre, which reads as visible facets once
          a bright specular highlight lands on it. */}
      <cylinderGeometry args={[26, 26, 0.004, quality.tier === 'low' ? 48 : 96, 1, true]} />
      <primitive object={mat} attach="material" />
    </mesh>
  )
}

/**
 * Light rig. Every fixture is a real Three.js light whose intensity is written
 * each frame by the director, which is what makes chapters 01/02 and 09 feel
 * like a lighting desk being operated rather than a fade toggling.
 */
export type LightRig = {
  key: THREE.SpotLight
  rim: THREE.SpotLight
  back: THREE.SpotLight
  wash: THREE.SpotLight
  fill: THREE.PointLight
  accentFront: THREE.PointLight
  accentRear: THREE.PointLight
  headGlow: THREE.SpotLight
  tailGlow: THREE.PointLight
}

export function Lights({
  quality,
  onReady,
}: {
  quality: Quality
  onReady: (rig: LightRig) => void
}): JSX.Element {
  const key = useRef<THREE.SpotLight>(null)
  const rim = useRef<THREE.SpotLight>(null)
  const back = useRef<THREE.SpotLight>(null)
  const wash = useRef<THREE.SpotLight>(null)
  const fill = useRef<THREE.PointLight>(null)
  const accentFront = useRef<THREE.PointLight>(null)
  const accentRear = useRef<THREE.PointLight>(null)
  const headGlow = useRef<THREE.SpotLight>(null)
  const tailGlow = useRef<THREE.PointLight>(null)

  const shadows = quality.shadows

  useEffect(() => {
    if (key.current && rim.current && back.current && wash.current && fill.current && accentFront.current && accentRear.current && headGlow.current && tailGlow.current) {
      onReady({
        key: key.current,
        rim: rim.current,
        back: back.current,
        wash: wash.current,
        fill: fill.current,
        accentFront: accentFront.current,
        accentRear: accentRear.current,
        headGlow: headGlow.current,
        tailGlow: tailGlow.current,
      })
    }
  }, [onReady, quality.tier])

  return (
    <>
      {/* Ambient floor bounce — deliberately tiny so blacks stay black. */}
      {/* Ambient and hemisphere are kept low, but not at zero: with nothing to
          lift the shadow side, every unlit surface crushes to pure black and
          the machine reads as a paper cut-out. */}
      <ambientLight intensity={0.05} color={0x25334a} />
      <hemisphereLight intensity={0.09} color={0x33465f} groundColor={0x06080c} />

      {/* Key: large frontal softbox, raking the front three-quarter. */}
      <spotLight
        ref={key}
        position={[4.0, 3.4, 1.5]}
        angle={0.72}
        penumbra={1}
        decay={1.35}
        distance={24}
        intensity={0}
        color={0xdce8f4}
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0016}
        shadow-normalBias={0.022}
      />
      {/* Rim: hard back edge from the right, gives the silhouette its outline. */}
      <spotLight
        ref={rim}
        position={[-4.2, 2.3, -2.4]}
        angle={0.65}
        penumbra={0.92}
        decay={1.4}
        distance={22}
        intensity={0}
        color={0x9dc0ea}
      />
      {/* Back-left kicker, slightly warm, separates the tail from the dark. */}
      <spotLight
        ref={back}
        position={[3.6, 0.9, -3.1]}
        angle={0.6}
        penumbra={0.9}
        decay={1.5}
        distance={20}
        intensity={0}
        color={0xd9cdba}
      />
      {/* Overhead wash: broad, low, defines the tank and seat planes. */}
      <spotLight
        ref={wash}
        position={[-0.4, 6.4, -1.4]}
        angle={0.85}
        penumbra={1}
        decay={1.15}
        distance={26}
        intensity={0}
        color={0xa9bed6}
        castShadow={shadows && quality.tier === 'high'}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0016}
        shadow-normalBias={0.024}
      />
      {/* Practical accents inside the machine. */}
      <pointLight ref={fill} position={[0, 0.5, 0.05]} intensity={0} color={0x6fc2ff} distance={1.9} decay={2} />
      <pointLight ref={accentFront} position={[0, 1.02, 0.52]} intensity={0} color={0xbfe0ff} distance={2.6} decay={2} />
      <pointLight ref={accentRear} position={[0, 0.44, -0.34]} intensity={0} color={0x7fb6ff} distance={2.2} decay={2} />
      {/* The headlight actually lights the room when it fires. */}
      <spotLight
        ref={headGlow}
        position={[0, 1.04, 0.4]}
        target-position={[0, 0.6, 4.2]}
        angle={0.42}
        penumbra={0.75}
        decay={1.1}
        distance={18}
        intensity={0}
        color={0xd6eaff}
      />
      <pointLight ref={tailGlow} position={[0, 0.94, -0.62]} intensity={0} color={0xff3b4d} distance={1.6} decay={2} />
    </>
  )
}
