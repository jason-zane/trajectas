import { OVERALL_ID, type CanvasPoint, type CanvasResult } from '@/lib/canvas/types'

export type Experience = 'compare' | 'individual' | 'unified'
export type Lens = 'snapshot' | 'time'
export type Population = 'Employee' | 'Candidate' | 'Participant'
export type PersonContext = { role: string; population: Population }
export type StudioSettings = {
  people: string[]
  assessment: string
  campaign: string
  from: string
  to: string
  metric: string
  lens: Lens
  representation: 'chart' | 'table'
  showIntervals: boolean
  includeAllAssessments: boolean
}
export type StudioDataset = {
  result: CanvasResult
  context?: Record<string, PersonContext>
  workspaceName: string
  demo: boolean
}

export function uniqueSessions(result: CanvasResult, personKey?: string): CanvasPoint[] {
  const sessions = new Map<string, CanvasPoint>()
  for (const series of result.series) {
    if (personKey && series.personKey !== personKey) continue
    for (const point of series.points) sessions.set(point.sessionId, point)
  }
  return [...sessions.values()].sort((a, b) => a.completedAt.localeCompare(b.completedAt) || a.sessionId.localeCompare(b.sessionId))
}

export function assessmentOptions(result: CanvasResult) {
  const values = new Map<string, string>()
  for (const session of uniqueSessions(result)) values.set(session.assessmentId, session.assessmentName)
  return [...values].map(([id, name]) => ({ id, name }))
}

export function campaignOptions(result: CanvasResult) {
  const values = new Map<string, string>()
  for (const session of uniqueSessions(result)) if (session.campaignId) values.set(session.campaignId, session.campaignTitle)
  return [...values].map(([id, name]) => ({ id, name }))
}

export function initialSettings(result: CanvasResult, experience: Experience): StudioSettings {
  const sessions = uniqueSessions(result)
  const assessment = assessmentOptions(result)[0]?.id ?? ''
  const measured = new Set(result.series.filter((series) => series.points.some((point) => point.assessmentId === assessment)).map((series) => series.entityId))
  const metric = measured.has(OVERALL_ID) ? OVERALL_ID : result.entities.find((entity) => entity.level === 'dimension' && measured.has(entity.id))?.id ?? result.entities.find((entity) => measured.has(entity.id))?.id ?? OVERALL_ID
  return {
    people: result.people.slice(0, experience === 'individual' ? 1 : 4).map((p) => p.personKey),
    assessment,
    campaign: 'all',
    from: sessions[0]?.completedAt.slice(0, 10) ?? '',
    to: sessions.at(-1)?.completedAt.slice(0, 10) ?? '',
    metric,
    lens: experience === 'individual' ? 'time' : 'snapshot',
    representation: 'chart',
    showIntervals: false,
    includeAllAssessments: false,
  }
}

/** One instrument at a time: even equally named factors may have different score bases. */
export function scopedPoints(result: CanvasResult, personKey: string, entityId: string, settings: StudioSettings): CanvasPoint[] {
  if (!settings.assessment || (settings.from && settings.to && settings.from > settings.to)) return []
  return (result.series.find((s) => s.personKey === personKey && s.entityId === entityId)?.points ?? [])
    .filter((p) => {
      const date = p.completedAt.slice(0, 10)
      return p.assessmentId === settings.assessment
        && (settings.campaign === 'all' || p.campaignId === settings.campaign)
        && (!settings.from || date >= settings.from)
        && (!settings.to || date <= settings.to)
        && Number.isFinite(p.value)
    })
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt) || a.sessionId.localeCompare(b.sessionId))
}

/** Resolve the attempt ONCE per person, rather than silently filling gaps from older attempts. */
export function snapshotSession(result: CanvasResult, personKey: string, settings: StudioSettings): CanvasPoint | null {
  if (!settings.assessment || (settings.from && settings.to && settings.from > settings.to)) return null
  return uniqueSessions(result, personKey).filter((p) => {
    const date = p.completedAt.slice(0, 10)
    return p.assessmentId === settings.assessment
      && (settings.campaign === 'all' || settings.campaign === p.campaignId)
      && (!settings.from || date >= settings.from)
      && (!settings.to || date <= settings.to)
  }).at(-1) ?? null
}

export function snapshotPoint(result: CanvasResult, personKey: string, entityId: string, settings: StudioSettings): CanvasPoint | null {
  const session = snapshotSession(result, personKey, settings)
  return scopedPoints(result, personKey, entityId, settings).find((p) => p.sessionId === session?.sessionId) ?? null
}

export function changeFor(points: CanvasPoint[]): number | null {
  return points.length > 1 ? points[points.length - 1].value - points[0].value : null
}

export function signed(value: number | null): string {
  if (value === null) return '—'
  const rounded = Math.round(value * 10) / 10
  return `${rounded > 0 ? '+' : ''}${rounded}`
}

export function score(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${Math.round(value * 10) / 10}`
}

export function displayDate(value: string | null | undefined, short = false): string {
  if (!value) return 'No result'
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: short ? 'short' : 'short', ...(short ? {} : { year: 'numeric' }), timeZone: 'UTC' }).format(new Date(value))
}

export function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase()
}

export function measures(result: CanvasResult, settings: StudioSettings) {
  const measured = new Set(result.series.filter((s) => s.points.some((p) => p.assessmentId === settings.assessment)).map((s) => s.entityId))
  const active = result.entities.filter((entity) => measured.has(entity.id))
  const sort = (a: typeof active[number], b: typeof active[number]) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name)
  const dimensions = active.filter((entity) => entity.level === 'dimension').sort(sort)
  const dimensionIds = new Set(dimensions.map((entity) => entity.id))
  const ordered = dimensions.flatMap((dimension) => [dimension, ...active.filter((entity) => entity.parentId === dimension.id).sort(sort)])
  const ungrouped = active.filter((entity) => entity.level === 'factor' && (!entity.parentId || !dimensionIds.has(entity.parentId))).sort(sort)
  return [
    ...(measured.has(OVERALL_ID) ? [{ id: OVERALL_ID, name: 'Overall score', level: 'overall', parentId: null, displayOrder: -1 }] : []),
    ...ordered, ...ungrouped,
  ]
}

export type ExportRow = {
  personKey: string; person: string; assessment: string; measure: string; level: string; score: string;
  completed: string; campaign: string; attempt: number; session: string;
  baseline: string; change: string; lower: string; upper: string;
}

export function exportRows(dataset: StudioDataset, settings: StudioSettings, anonymize: boolean): ExportRow[] {
  if (settings.representation === 'table' && settings.includeAllAssessments) {
    return assessmentOptions(dataset.result).flatMap((a) => exportRows(dataset, { ...settings, assessment: a.id, includeAllAssessments: false }, anonymize))
  }
  const rows: ExportRow[] = []
  const entities = measures(dataset.result, settings)
  settings.people.forEach((key, index) => {
    const person = dataset.result.people.find((p) => p.personKey === key)
    if (!person) return
    for (const entity of entities) {
      const all = scopedPoints(dataset.result, key, entity.id, settings)
      const latest = snapshotPoint(dataset.result, key, entity.id, settings)
      const points = settings.lens === 'time' ? all : latest ? [latest] : []
      for (const point of points) rows.push({
        personKey: key,
        person: anonymize ? `Person ${index + 1}` : person.displayName,
        assessment: point.assessmentName, measure: entity.name, level: entity.level, score: score(point.value),
        completed: point.completedAt, campaign: point.campaignTitle, attempt: point.attemptNumber,
        session: anonymize ? '' : point.sessionId,
        baseline: settings.lens === 'time' ? all[0]?.completedAt ?? '' : '',
        change: settings.lens === 'time' && all.length > 1 ? signed(point.value - all[0].value) : '',
        lower: point.ciLower === null ? '' : score(point.ciLower), upper: point.ciUpper === null ? '' : score(point.ciUpper),
      })
    }
  })
  return rows
}

/** Neutralize spreadsheet formulas, including leading whitespace/control characters. */
function csvCell(value: string | number): string {
  let safe = String(value)
  if (typeof value === 'string' && /^[\s\u0000-\u001f]*[=+@-]/.test(safe)) safe = `'${safe}`
  return `"${safe.replace(/"/g, '""')}"`
}

export function buildStudioCsv(dataset: StudioDataset, settings: StudioSettings, anonymize: boolean): string {
  const rows = exportRows(dataset, settings, anonymize)
  const header = ['Source', 'View', 'Window start', 'Window end', 'Person', 'Assessment', 'Measure', 'Measure type', 'Scaled score (0–100)', 'Completed at (UTC)', 'Campaign', 'Attempt', 'Session ID', 'Baseline date (UTC)', 'Change (points)', 'Interval lower', 'Interval upper']
  return '\uFEFF' + [header, ...rows.map((r) => [dataset.demo ? 'Illustrative demo data' : 'Trajectas', settings.lens, settings.from, settings.to, r.person, r.assessment, r.measure, r.level, Number(r.score), r.completed, r.campaign, r.attempt, r.session, r.baseline, r.change === '' ? '' : Number(r.change), r.lower === '' ? '' : Number(r.lower), r.upper === '' ? '' : Number(r.upper)])].map((r) => r.map(csvCell).join(',')).join('\r\n')
}

export function validateSavedSettings(value: unknown, result: CanvasResult): StudioSettings | null {
  if (!value || typeof value !== 'object') return null
  const s = value as Record<string, unknown>
  const stringFields = ['assessment', 'campaign', 'from', 'to', 'metric']
  if (stringFields.some((field) => typeof s[field] !== 'string')) return null
  if (!Array.isArray(s.people) || s.people.length > 8 || s.people.some((p) => typeof p !== 'string')) return null
  if (s.lens !== 'snapshot' && s.lens !== 'time') return null
  if (s.representation !== 'chart' && s.representation !== 'table') return null
  if (typeof s.showIntervals !== 'boolean' || typeof s.includeAllAssessments !== 'boolean') return null
  if (![s.from, s.to].every((d) => d === '' || /^\d{4}-\d{2}-\d{2}$/.test(d as string))) return null
  if (!assessmentOptions(result).some((a) => a.id === s.assessment)) return null
  if (s.campaign !== 'all' && !campaignOptions(result).some((c) => c.id === s.campaign)) return null
  if (s.metric !== OVERALL_ID && !result.entities.some((e) => e.id === s.metric)) return null
  const keys = new Set(result.people.map((p) => p.personKey))
  return { ...s, people: [...new Set(s.people as string[])].filter((p) => keys.has(p)) } as StudioSettings
}
