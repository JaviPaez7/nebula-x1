import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'

/**
 * Studio environment probe.
 *
 * Machined aluminium, titanium and clearcoat are mirror-like surfaces: with
 * nothing in the environment to reflect they render as flat black, no matter
 * how many lights are pointed at them. This builds a tiny room of emissive
 * panels — one large overhead softbox, two side scrims, a cool kicker behind
 * and a dark floor — and convolves it into an environment map with the
 * renderer's own PMREM generator.
 *
 * The result is real reflections in the metal for the cost of one texture and
 * no downloaded HDRI.
 */
export function StudioEnvironment({ intensity = 1 }: { intensity?: number }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)

  const envMap = useMemo(() => {
    const room = new THREE.Scene()

    const panel = (
      w: number,
      h: number,
      color: number,
      power: number,
      position: [number, number, number],
      lookAt: [number, number, number],
      rotation?: [number, number, number],
    ) => {
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(power) })
      const geo = new THREE.PlaneGeometry(w, h)
      const m = new THREE.Mesh(geo, mat)
      m.position.set(position[0], position[1], position[2])
      if (rotation) m.rotation.set(rotation[0], rotation[1], rotation[2])
      else m.lookAt(new THREE.Vector3(lookAt[0], lookAt[1], lookAt[2]))
      room.add(m)
    }

    // Enclosing box so the probe has an interior rather than an infinite void.
    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(20, 12, 20),
      new THREE.MeshBasicMaterial({ color: 0x0b0e13, side: THREE.BackSide }),
    )
    room.add(shell)

    // Overhead softbox: the dominant highlight running along the machine.
    panel(9, 3.6, 0xe8f1fb, 4.2, [0, 5.4, 0.5], [0, 0, 0], [-Math.PI / 2, 0, 0])
    // Two long side scrims that draw the length of the bodywork.
    panel(11, 2.4, 0xcfe0f2, 2.1, [-5.2, 2.4, 0], [0, 0.8, 0])
    panel(11, 2.4, 0xbcd0e6, 1.5, [5.2, 2.4, 0], [0, 0.8, 0])
    // A cool kicker behind, so the tail and swingarm read against the dark.
    panel(6, 3, 0x9dc4ea, 1.6, [0, 2.6, -6.4], [0, 0.8, 0])
    // Warm low fill in front, which is what makes carbon look like carbon.
    panel(5, 2, 0xf0dfc8, 0.85, [0, 1.2, 6.6], [0, 0.7, 0])

    const pmrem = new THREE.PMREMGenerator(gl)
    pmrem.compileEquirectangularShader()
    const target = pmrem.fromScene(room, 0.04, 0.1, 40)
    pmrem.dispose()
    room.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.geometry.dispose()
        ;(m.material as THREE.Material).dispose()
      }
    })
    return target.texture
  }, [gl])

  useEffect(() => {
    scene.environment = envMap
    scene.environmentIntensity = intensity
    return () => {
      scene.environment = null
      envMap.dispose()
    }
  }, [scene, envMap, intensity])

  return null
}
