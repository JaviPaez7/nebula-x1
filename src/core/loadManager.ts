/**
 * Genuine loading progress.
 *
 * Every expensive boot step (procedural textures, shader compilation, WebGL
 * warm-up, font metrics) registers a weighted task here. The curtain only
 * lifts when the real work is finished, never on a timer.
 */

export type LoadTask = {
  id: string
  label: string
  weight: number
}

type Listener = (progress: number, label: string) => void

class LoadManager {
  private tasks: LoadTask[] = []
  private done = new Set<string>()
  private listeners = new Set<Listener>()
  private _progress = 0
  private _label = 'Initialising'

  get progress() {
    return this._progress
  }

  get label() {
    return this._label
  }

  /** Declare a unit of work. Returns a `complete` callback. */
  task(id: string, label: string, weight = 1) {
    this.tasks.push({ id, label, weight })
    return () => this.complete(id)
  }

  /** Declare a task and immediately resolve it (for work already finished). */
  instant(id: string, label: string, weight = 1) {
    this.tasks.push({ id, label, weight })
    this.complete(id)
  }

  complete(id: string) {
    if (this.done.has(id)) return
    this.done.add(id)
    if (this.done.size < this.tasks.length) {
      const next = this.tasks.find((t) => !this.done.has(t.id))
      if (next) this._label = next.label
    } else {
      this._label = 'Ready'
    }
    this.recompute()
  }

  private recompute() {
    const total = this.tasks.reduce((s, t) => s + t.weight, 0) || 1
    const finished = this.tasks.reduce((s, t) => (this.done.has(t.id) ? s + t.weight : s), 0)
    this._progress = Math.min(1, finished / total)
    for (const l of this.listeners) l(this._progress, this._label)
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn)
    fn(this._progress, this._label)
    return () => this.listeners.delete(fn)
  }

  /** Give the GPU a couple of frames to finish uploading before we reveal. */
  settle(frames = 4): Promise<void> {
    return new Promise((resolve) => {
      let n = frames
      const step = () => (n-- <= 0 ? resolve() : requestAnimationFrame(step))
      requestAnimationFrame(step)
    })
  }
}

export const loadManager = new LoadManager()
