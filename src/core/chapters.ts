/**
 * The experience is authored as 12 chapters laid out over one continuous
 * scroll track. Nothing here is pinned and nothing here scroll-jacks: the
 * document simply grows, and scroll progress through that document is the
 * single timeline value that drives the entire film.
 */

export type ChapterDef = {
  /** stable id, used by the chapter navigation and by `#hash` deep links */
  id: string
  /** short label for the navigation rail */
  label: string
  /** editorial subtitle shown in the HUD */
  index: string
  /** relative scroll length of the chapter */
  weight: number
}

export const CHAPTERS: ChapterDef[] = [
  { id: 'introduction', label: 'Introduction', index: '01', weight: 1.35 },
  { id: 'reveal', label: 'Reveal', index: '02', weight: 1.55 },
  { id: 'performance', label: 'Performance', index: '03', weight: 1.3 },
  { id: 'exploded', label: 'Composition', index: '04', weight: 1.75 },
  { id: 'battery', label: 'Energy', index: '05', weight: 1.5 },
  { id: 'motor', label: 'Drive', index: '06', weight: 1.45 },
  { id: 'aerodynamics', label: 'Airflow', index: '07', weight: 1.5 },
  { id: 'materials', label: 'Materials', index: '08', weight: 1.45 },
  { id: 'lighting', label: 'Signature', index: '09', weight: 1.2 },
  { id: 'cockpit', label: 'Interface', index: '10', weight: 1.35 },
  { id: 'ride', label: 'Velocity', index: '11', weight: 1.4 },
  { id: 'finale', label: 'The Machine', index: '12', weight: 1.6 },
]

export type ChapterRange = ChapterDef & {
  /** absolute progress at which the chapter starts (0..1) */
  start: number
  /** absolute progress at which the chapter ends (0..1) */
  end: number
  /** index in the CHAPTERS array */
  i: number
}

const TOTAL_WEIGHT = CHAPTERS.reduce((sum, c) => sum + c.weight, 0)

export const RANGES: ChapterRange[] = (() => {
  let acc = 0
  return CHAPTERS.map((c, i) => {
    const start = acc / TOTAL_WEIGHT
    acc += c.weight
    const end = acc / TOTAL_WEIGHT
    return { ...c, start, end, i }
  })
})()

export const CHAPTER_BY_ID: Record<string, ChapterRange> = Object.fromEntries(
  RANGES.map((r) => [r.id, r]),
)

/**
 * Convert a chapter-relative position (0 = chapter start, 1 = chapter end)
 * into an absolute timeline value. Values outside 0..1 extrapolate so that
 * camera moves can deliberately bleed past a chapter boundary — this is what
 * keeps the transitions continuous instead of cut-like.
 */
export const at = (id: string, local: number): number => {
  const r = CHAPTER_BY_ID[id]
  if (!r) throw new Error(`Unknown chapter: ${id}`)
  return r.start + (r.end - r.start) * local
}

/** Total scrollable length of the page, in viewport heights. */
export const SCROLL_VH = 12 * 130 // ~1560vh of scroll track for the whole film
