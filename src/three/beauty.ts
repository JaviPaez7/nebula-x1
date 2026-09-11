import * as THREE from 'three'

/**
 * Development-only beauty pass.
 *
 * When `__BEAUTY__` is set to a view index, the director frames the machine
 * from a fixed studio angle instead of following the shot list. This is how
 * the model itself is judged, independently of the cinematography.
 */
const VIEWS: [number, number, number][] = [
  [3.9, 1.55, 3.1],
  [6.3, 1.05, 0.0],
  [2.6, 1.9, 4.2],
  [-2.4, 1.3, 4.1],
  [1.2, 1.6, -4.4],
  [4.2, 0.9, -3.4],
  [0.0, 4.2, 3.2],
]

const target = new THREE.Vector3(0, 0.6, 0)

/** Studio light values used when the beauty override is active. */
export const BEAUTY_LIGHTS = {
  key: 96,
  rim: 52,
  back: 26,
  wash: 36,
  fill: 4,
  accentFront: 2,
  accentRear: 1.6,
  head: 6,
  tail: 2,
}

export function beautyActive(): boolean {
  return typeof (window as unknown as Record<string, unknown>).__BEAUTY__ === 'number'
}

/** Returns true when it took over the camera. */
export function applyBeautyCamera(camera: THREE.PerspectiveCamera): boolean {
  const idx = (window as unknown as Record<string, unknown>).__BEAUTY__
  if (typeof idx !== 'number') return false
  const p = VIEWS[idx % VIEWS.length]
  camera.position.set(p[0], p[1], p[2])
  camera.up.set(0, 1, 0)
  camera.lookAt(target)
  if (Math.abs(camera.fov - 30) > 1e-4) {
    camera.fov = 30
    camera.updateProjectionMatrix()
  }
  return true
}
