/**
 * Development-only: hide every part group except a chosen subset, so an
 * unidentified shape in a beauty shot can be attributed to an assembly.
 */
const LABELS = [
  'frontWheel',
  'fork',
  'headlight',
  'cockpit',
  'bodywork',
  'chassis',
  'battery',
  'motor',
  'swingarm',
  'rearWheel',
  'seat',
]

export function applyPartIsolation(refs: { groups: (import('three').Group | null)[] }) {
  const spec = (window as unknown as Record<string, unknown>).__ONLY__
  if (typeof spec !== 'string') return
  const keep = new Set(
    spec
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name) => LABELS.indexOf(name))
      .filter((i) => i >= 0),
  )
  for (let i = 0; i < refs.groups.length; i++) {
    const g = refs.groups[i]
    if (g) g.visible = keep.size === 0 || keep.has(i)
  }
}
