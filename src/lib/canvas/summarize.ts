/**
 * Pure helpers behind the canvas breakdown rows and hero lede: per-person
 * stats for an entity, row ordering, and the plain-language sentence
 * fragments ("Biggest change Priya +27 · Everyone sits between 59 and 78").
 * No Supabase, fully unit-testable.
 */

import type {
  CanvasEntity,
  CanvasOrder,
  CanvasSeries,
} from './types'
import { byDisplayOrder } from '@/lib/taxonomy-order'

/** Changes smaller than this are presented as "within noise" (grey chip). */
export const NOISE_FLOOR = 3

export type PersonStat = {
  personKey: string
  first: number | null
  latest: number | null
  /** latest − first; null when fewer than two measured sessions. */
  delta: number | null
  /**
   * Whether the change clears measurement error, judged by the stored
   * confidence bands of the first and latest scores (true when the bands
   * do not overlap). Null when either end lacks a stored band — consumers
   * fall back to the NOISE_FLOOR heuristic.
   */
  significant: boolean | null
}

export function statsFor(
  series: CanvasSeries[],
  entityId: string,
  personKeys: string[],
): PersonStat[] {
  const byPerson = new Map(
    series.filter((s) => s.entityId === entityId).map((s) => [s.personKey, s]),
  )
  return personKeys.map((personKey) => {
    const points = byPerson.get(personKey)?.points ?? []
    if (points.length === 0) {
      return { personKey, first: null, latest: null, delta: null, significant: null }
    }
    const firstPoint = points[0]
    const lastPoint = points[points.length - 1]
    let significant: boolean | null = null
    if (
      points.length >= 2 &&
      firstPoint.ciLower !== null &&
      firstPoint.ciUpper !== null &&
      lastPoint.ciLower !== null &&
      lastPoint.ciUpper !== null
    ) {
      significant =
        lastPoint.ciLower > firstPoint.ciUpper || lastPoint.ciUpper < firstPoint.ciLower
    }
    return {
      personKey,
      first: firstPoint.value,
      latest: lastPoint.value,
      delta: points.length >= 2 ? lastPoint.value - firstPoint.value : null,
      significant,
    }
  })
}

/**
 * Is a change worth highlighting? Confidence bands win when stored;
 * otherwise the ±NOISE_FLOOR heuristic.
 */
export function isMeaningfulChange(stat: Pick<PersonStat, 'delta' | 'significant'>): boolean {
  if (stat.delta === null) return false
  if (stat.significant !== null) return stat.significant
  return Math.abs(stat.delta) >= NOISE_FLOOR
}

/** Largest |delta| across people; 0 when nobody has a measurable change. */
export function maxAbsChange(stats: PersonStat[]): number {
  return stats.reduce((acc, s) => Math.max(acc, s.delta === null ? 0 : Math.abs(s.delta)), 0)
}

/** Gap between the highest and lowest current scores; 0 with fewer than two. */
export function spread(stats: PersonStat[]): number {
  const latests = stats.map((s) => s.latest).filter((v): v is number => v !== null)
  if (latests.length < 2) return 0
  return Math.max(...latests) - Math.min(...latests)
}

export function orderEntities(
  entities: CanvasEntity[],
  metricById: (entityId: string) => number,
  order: CanvasOrder,
): CanvasEntity[] {
  const sorted = [...entities]
  if (order === 'standard') {
    // "Standard" is the framework's own order, not the alphabet's.
    sorted.sort(byDisplayOrder)
  } else {
    sorted.sort((a, b) => {
      const m = metricById(b.id) - metricById(a.id)
      if (m !== 0) return m
      return byDisplayOrder(a, b)
    })
  }
  return sorted
}

export function formatSigned(v: number): string {
  return v > 0 ? `+${v}` : String(v)
}

/** Page/report title for a selection of people. */
export function canvasTitle(people: { displayName: string }[]): string {
  if (people.length === 0) return 'Trajectory'
  if (people.length === 1) return people[0].displayName
  if (people.length === 2) return `${people[0].displayName} vs ${people[1].displayName}`
  return `Comparing ${people.length} people`
}

export function monthYear(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

/** The person with the largest |delta|, or null when nobody moved measurably. */
export function biggestChange(
  stats: PersonStat[],
): { personKey: string; delta: number } | null {
  let best: { personKey: string; delta: number } | null = null
  for (const s of stats) {
    if (s.delta === null) continue
    if (!best || Math.abs(s.delta) > Math.abs(best.delta)) {
      best = { personKey: s.personKey, delta: s.delta }
    }
  }
  return best
}

/** "Everyone sits between 48 and 78" — or null when fewer than two scores. */
export function rangeSentence(stats: PersonStat[]): string | null {
  const latests = stats.map((s) => s.latest).filter((v): v is number => v !== null)
  if (latests.length < 2) return null
  const lo = Math.min(...latests)
  const hi = Math.max(...latests)
  if (lo === hi) return `Everyone sits at ${lo}`
  return `Everyone sits between ${lo} and ${hi}`
}

/**
 * Hero lede for a multi-person comparison on one entity:
 * "Priya Sharma has risen the most on Relating (+27 since Sep 2025).
 *  Ben Castillo is highest today." Falls back gracefully when nobody has
 * a measurable change or scores are missing.
 */
export function comparisonLede(args: {
  entityName: string
  stats: PersonStat[]
  nameByPerson: Map<string, string>
  sinceLabel: string | null
}): string {
  const { entityName, stats, nameByPerson, sinceLabel } = args
  const name = (key: string) => nameByPerson.get(key) ?? 'Someone'
  const top = stats
    .filter((s) => s.latest !== null)
    .sort((a, b) => (b.latest as number) - (a.latest as number))[0]
  const riser = biggestChange(stats)

  if (!top) return `No completed assessments yet for ${entityName}.`

  const parts: string[] = []
  if (riser && Math.abs(riser.delta) >= NOISE_FLOOR) {
    const verb = riser.delta > 0 ? 'risen the most' : 'moved the most'
    const since = sinceLabel ? ` since ${sinceLabel}` : ''
    parts.push(
      `${name(riser.personKey)} has ${verb} on ${entityName} (${formatSigned(riser.delta)}${since}).`,
    )
    if (top.personKey !== riser.personKey) {
      parts.push(`${name(top.personKey)} is highest today.`)
    }
  } else {
    parts.push(`Little movement on ${entityName} so far.`)
    parts.push(`${name(top.personKey)} is highest today at ${top.latest}.`)
  }
  return parts.join(' ')
}

/**
 * Hero lede for a single person, built from the charted node's children:
 * "4 assessments since Sep 2025. Biggest shift: Influence (+18)."
 */
export function soloLede(args: {
  childStats: { name: string; delta: number | null }[]
  sessionCount: number
  sinceLabel: string | null
}): string {
  const { childStats, sessionCount, sinceLabel } = args
  const since = sinceLabel ? ` since ${sinceLabel}` : ''
  const head = `${sessionCount} assessment${sessionCount === 1 ? '' : 's'}${since}.`
  let best: { name: string; delta: number } | null = null
  for (const c of childStats) {
    if (c.delta === null) continue
    if (!best || Math.abs(c.delta) > Math.abs(best.delta)) {
      best = { name: c.name, delta: c.delta }
    }
  }
  if (!best || Math.abs(best.delta) < NOISE_FLOOR) {
    return sessionCount < 2
      ? `${head} A baseline — movement appears after the next assessment.`
      : `${head} Scores have held steady.`
  }
  return `${head} Biggest shift: ${best.name} (${formatSigned(best.delta)}).`
}
