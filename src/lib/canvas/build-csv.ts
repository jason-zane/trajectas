/**
 * CSV export of a trajectory canvas. Mirrors the breakdown list: one row
 * per competency (Overall, then dimensions, then factors grouped under
 * their dimension), with per-person columns for first, latest, and change,
 * followed by each person's per-session values with dates.
 */

import { statsFor } from './summarize'
import { OVERALL_ID, type CanvasResult, type CanvasSeries } from './types'

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function sessionDates(series: CanvasSeries[], personKey: string): { sessionId: string; date: string }[] {
  const overall = series.find((s) => s.personKey === personKey && s.entityId === OVERALL_ID)
  return (overall?.points ?? []).map((p) => ({
    sessionId: p.sessionId,
    date: p.completedAt.slice(0, 10),
  }))
}

export function buildCanvasCsv(result: CanvasResult): string {
  const personKeys = result.people.map((p) => p.personKey)
  const datesByPerson = new Map(
    personKeys.map((pk) => [pk, sessionDates(result.series, pk)]),
  )

  const header: string[] = ['Competency', 'Level']
  for (const person of result.people) {
    header.push(`${person.displayName} first`)
    header.push(`${person.displayName} latest`)
    header.push(`${person.displayName} change`)
    for (const s of datesByPerson.get(person.personKey) ?? []) {
      header.push(`${person.displayName} ${s.date}`)
    }
  }

  const valueAtSession = (entityId: string, personKey: string, sessionId: string) => {
    const series = result.series.find(
      (s) => s.personKey === personKey && s.entityId === entityId,
    )
    return series?.points.find((p) => p.sessionId === sessionId)?.value ?? null
  }

  const rowFor = (entityId: string, name: string, level: string): string[] => {
    const cells: (string | number | null)[] = [name, level]
    const stats = statsFor(result.series, entityId, personKeys)
    result.people.forEach((person, i) => {
      const s = stats[i]
      cells.push(s.first, s.latest, s.delta)
      for (const sess of datesByPerson.get(person.personKey) ?? []) {
        cells.push(valueAtSession(entityId, person.personKey, sess.sessionId))
      }
    })
    return cells.map(escapeCell)
  }

  const lines: string[] = [header.map(escapeCell).join(',')]
  lines.push(rowFor(OVERALL_ID, 'Overall', 'composite').join(','))

  const dimensions = result.entities
    .filter((e) => e.level === 'dimension')
    .sort((a, b) => a.name.localeCompare(b.name))
  for (const dim of dimensions) {
    lines.push(rowFor(dim.id, dim.name, 'dimension').join(','))
    const factors = result.entities
      .filter((e) => e.level === 'factor' && e.parentId === dim.id)
      .sort((a, b) => a.name.localeCompare(b.name))
    for (const factor of factors) {
      lines.push(rowFor(factor.id, factor.name, 'factor').join(','))
    }
  }
  // Factors whose dimension is unknown still export, flagged as orphans.
  const orphans = result.entities
    .filter((e) => e.level === 'factor' && !e.parentId)
    .sort((a, b) => a.name.localeCompare(b.name))
  for (const factor of orphans) {
    lines.push(rowFor(factor.id, factor.name, 'factor').join(','))
  }

  return lines.join('\n')
}
