/**
 * A tiny mutable channel between the render loop and the DOM layer.
 *
 * React state is deliberately kept out of the animation path: the 3D director
 * writes these values once per frame and any DOM component that needs them
 * reads them inside its own registration callback. That keeps a 60 fps film
 * from triggering sixty reconciliations a second.
 */
export const domSignals = {
  progress: 0,
  rawProgress: 0,
  velocity: 0,
  elapsed: 0,
  /** 0..1 relevance of the cockpit interface */
  cockpit: 0,
  /** 0..1 reveal of the specification sheet */
  specs: 0,
  /** 0..1 exploded amount, for the callout labels */
  explode: 0,
  lightHead: 0,
  ride: 0,
  exposure: 1,
}

export type DomTick = (s: typeof domSignals) => void

const listeners = new Set<DomTick>()

/** Register a per-frame DOM update. Returns an unsubscribe function. */
export function onDomTick(fn: DomTick): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function emitDomTick() {
  for (const fn of listeners) fn(domSignals)
}
