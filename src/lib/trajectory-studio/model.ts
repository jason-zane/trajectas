import { OVERALL_ID, type CanvasPoint, type CanvasResult } from '@/lib/canvas/types'

export type Experience = 'compare' | 'individual' | 'unified'
export type Lens = 'snapshot' | 'time'
export type PersonContext = { role: string }
export type StudioSettings = {
  people: string[]
  assessment: string
  /** Campaign and dates scope history only. Snapshots use explicit assessment attempts. */
  campaign: string
  from: string
  to: string
  metric: string
  timeMeasures: string[]
  snapshotDetail: string
  /** Keys include both stable person identity and assessment identity. Null is an explicit missing selection. */
  snapshotSelections: Record<string, string | null>
  reference: string
  valueMode: 'score' | 'difference'
  lens: Lens
  representation: 'chart' | 'table'
  showIntervals: boolean
  includeAllAssessments: boolean
}
export type StudioReference = {
  id: string
  assessmentId: string
  name: string
  kind: 'norm' | 'target'
  scale: 'scaled-0-100'
  version: string
  description: string
  illustrative: boolean
  values: Record<string, { value: number; n?: number }>
}
export type StudioDataset = {
  result: CanvasResult
  context?: Record<string, PersonContext>
  references?: StudioReference[]
  workspaceName: string
  demo: boolean
}
export type ReferenceValue = { value: number | null; n: number | null; label: string; description: string; version: string }

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
export function campaignOptions(result: CanvasResult, assessment?: string) {
  const values = new Map<string, string>()
  for (const session of uniqueSessions(result)) if (session.campaignId && (!assessment || session.assessmentId === assessment)) values.set(session.campaignId, session.campaignTitle)
  return [...values].map(([id, name]) => ({ id, name }))
}
export function snapshotKey(personKey: string, assessmentId: string): string { return JSON.stringify([personKey, assessmentId]) }

export function initialSettings(result: CanvasResult, experience: Experience): StudioSettings {
  const sessions = uniqueSessions(result)
  const assessment = assessmentOptions(result)[0]?.id ?? ''
  const available = measures(result, { assessment })
  const metric = available[0]?.id ?? OVERALL_ID
  const dimensions = available.filter((m) => m.level === 'dimension').map((m) => m.id)
  const snapshotSelections: StudioSettings['snapshotSelections'] = {}
  for (const person of result.people) {
    const own = uniqueSessions(result, person.personKey)
    for (const a of assessmentOptions(result)) snapshotSelections[snapshotKey(person.personKey, a.id)] = own.filter((s) => s.assessmentId === a.id).at(-1)?.sessionId ?? null
  }
  return {
    people: result.people.slice(0, experience === 'individual' ? 1 : 4).map((p) => p.personKey), assessment,
    campaign: 'all', from: sessions[0]?.completedAt.slice(0, 10) ?? '', to: sessions.at(-1)?.completedAt.slice(0, 10) ?? '',
    metric, timeMeasures: dimensions.length ? dimensions.slice(0, 5) : [metric], snapshotDetail: 'overview', snapshotSelections,
    reference: experience === 'individual' || result.people.length < 2 ? 'none' : 'group', valueMode: 'score',
    lens: experience === 'individual' ? 'time' : 'snapshot', representation: 'chart', showIntervals: false, includeAllAssessments: false,
  }
}

function inHistoryScope(point: CanvasPoint, settings: StudioSettings): boolean {
  const date = point.completedAt.slice(0, 10)
  return point.assessmentId === settings.assessment && (settings.campaign === 'all' || point.campaignId === settings.campaign)
    && (!settings.from || date >= settings.from) && (!settings.to || date <= settings.to)
    && !(settings.from && settings.to && settings.from > settings.to)
}
export function historySessions(result: CanvasResult, personKey: string, settings: StudioSettings): CanvasPoint[] {
  return uniqueSessions(result, personKey).filter((p) => inHistoryScope(p, settings))
}
/** One instrument at a time: equally named measures can still have different score bases. */
export function scopedPoints(result: CanvasResult, personKey: string, entityId: string, settings: StudioSettings): CanvasPoint[] {
  return (result.series.find((s) => s.personKey === personKey && s.entityId === entityId)?.points ?? [])
    .filter((p) => inHistoryScope(p, settings) && Number.isFinite(p.value))
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt) || a.sessionId.localeCompare(b.sessionId))
}
/** Explicit attempt selection never falls back to a different campaign, date, or person. */
export function snapshotSession(result: CanvasResult, personKey: string, settings: StudioSettings): CanvasPoint | null {
  const id = settings.snapshotSelections[snapshotKey(personKey, settings.assessment)]
  return uniqueSessions(result, personKey).find((p) => p.assessmentId === settings.assessment && p.sessionId === id) ?? null
}
export function snapshotPoint(result: CanvasResult, personKey: string, entityId: string, settings: StudioSettings): CanvasPoint | null {
  const session = snapshotSession(result, personKey, settings)
  return (result.series.find((s) => s.personKey === personKey && s.entityId === entityId)?.points ?? [])
    .find((p) => p.sessionId === session?.sessionId && p.assessmentId === settings.assessment && Number.isFinite(p.value)) ?? null
}
export function currentPoint(result: CanvasResult, personKey: string, entityId: string, settings: StudioSettings): CanvasPoint | null {
  return settings.lens === 'time' ? scopedPoints(result, personKey, entityId, settings).at(-1) ?? null : snapshotPoint(result, personKey, entityId, settings)
}
export function selectCampaign(result: CanvasResult, settings: StudioSettings, campaignId: string, personKey?: string): StudioSettings['snapshotSelections'] {
  const selections = { ...settings.snapshotSelections }
  for (const key of personKey ? [personKey] : settings.people) {
    selections[snapshotKey(key, settings.assessment)] = uniqueSessions(result, key).filter((p) => p.assessmentId === settings.assessment && p.campaignId === campaignId).at(-1)?.sessionId ?? null
  }
  return selections
}
export function snapshotCaption(result: CanvasResult, settings: StudioSettings): string {
  const campaigns = new Set(settings.people.map((key) => snapshotSession(result, key, settings)?.campaignTitle).filter(Boolean))
  return campaigns.size === 1 ? [...campaigns][0]! : campaigns.size > 1 ? `${campaigns.size} campaigns · one result per person` : 'Choose completed campaign results'
}
export function groupMean(result: CanvasResult, entityId: string, settings: StudioSettings): { value: number | null; n: number } {
  const points = [...new Set(settings.people)].flatMap((key) => {
    const point = snapshotPoint(result, key, entityId, settings)
    return point ? [point.value] : []
  })
  return { value: points.length >= 2 ? points.reduce((sum, value) => sum + value, 0) / points.length : null, n: points.length }
}
export function referenceOptions(dataset: StudioDataset, settings: StudioSettings): StudioReference[] {
  return (dataset.references ?? []).filter((r) => r.assessmentId === settings.assessment && r.scale === 'scaled-0-100' && !!r.version && (!r.illustrative || dataset.demo))
}
export function referenceFor(dataset: StudioDataset, settings: StudioSettings, entityId: string): ReferenceValue {
  if (settings.reference === 'group') return { ...groupMean(dataset.result, entityId, settings), label: 'Selected group mean', version: 'Selected snapshot results', description: `One selected result per person; available scores only. ${snapshotCaption(dataset.result, settings)}. Includes the person being compared. This is a descriptive group average, not a population norm.` }
  const ref = referenceOptions(dataset, settings).find((r) => r.id === settings.reference)
  const entry = ref?.values[entityId]
  const valid = entry && Number.isFinite(entry.value) && entry.value >= 0 && entry.value <= 100 && (ref?.kind !== 'norm' || (Number.isInteger(entry.n) && entry.n! >= 2))
  return { value: valid ? entry.value : null, n: valid ? entry.n ?? null : null, label: ref?.name ?? 'No reference', version: ref?.version ?? '', description: ref?.description ?? '' }
}
export function snapshotMeasures(result: CanvasResult, settings: StudioSettings) {
  const all = measures(result, settings)
  const overview = all.filter((m) => m.level !== 'factor')
  return settings.snapshotDetail === 'overview' ? overview.length ? overview : all : all.filter((m) => m.parentId === settings.snapshotDetail)
}
/** A single person's lines are measures. A group's lines are people on ONE measure. */
export function trajectorySeries(dataset: StudioDataset, settings: StudioSettings) {
  const all = measures(dataset.result, settings)
  return settings.people.length === 1 ? all.filter((m) => settings.timeMeasures.includes(m.id)).map((m) => ({
    id: m.id, label: m.name, entityId: m.id, personKey: settings.people[0],
    points: scopedPoints(dataset.result, settings.people[0], m.id, settings), reference: referenceFor(dataset, settings, m.id),
  })) : settings.people.map((key) => ({
    id: key, label: dataset.result.people.find((p) => p.personKey === key)?.displayName ?? 'Person', entityId: settings.metric, personKey: key,
    points: scopedPoints(dataset.result, key, settings.metric, settings), reference: referenceFor(dataset, settings, settings.metric),
  }))
}
export function changeFor(points: CanvasPoint[]): number | null { return points.length > 1 ? points.at(-1)!.value - points[0].value : null }
export function signed(value: number | null): string {
  if (value === null) return '—'
  const rounded = Math.sign(value) * Math.round(Math.abs(value) * 10) / 10
  return `${rounded > 0 ? '+' : ''}${rounded}`
}
export function score(value: number | null | undefined): string { return value === null || value === undefined ? '—' : `${Math.round(value * 10) / 10}` }
export function displayDate(value: string | null | undefined, short = false): string {
  if (!value) return 'No result'
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', ...(short ? {} : { year: 'numeric' }), timeZone: 'UTC' }).format(new Date(value))
}
export function initials(name: string): string { return name.trim().split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase() }
export function measures(result: CanvasResult, settings: Pick<StudioSettings, 'assessment'>) {
  const measured = new Set(result.series.filter((s) => s.points.some((p) => p.assessmentId === settings.assessment)).map((s) => s.entityId))
  const active = result.entities.filter((entity) => measured.has(entity.id))
  const sort = (a: typeof active[number], b: typeof active[number]) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name)
  const dimensions = active.filter((entity) => entity.level === 'dimension').sort(sort)
  const dimensionIds = new Set(dimensions.map((entity) => entity.id))
  const ordered = dimensions.flatMap((dimension) => [dimension, ...active.filter((entity) => entity.parentId === dimension.id).sort(sort)])
  const ungrouped = active.filter((entity) => entity.level === 'factor' && (!entity.parentId || !dimensionIds.has(entity.parentId))).sort(sort)
  return [...(measured.has(OVERALL_ID) ? [{ id: OVERALL_ID, name: 'Overall score', level: 'overall', parentId: null, displayOrder: -1 }] : []), ...ordered, ...ungrouped]
}

export type ExportRow = {
  personKey: string; person: string; assessmentId: string; assessment: string; measure: string; level: string; score: string;
  completed: string; campaign: string; attempt: number; session: string;
  baseline: string; change: string; lower: string; upper: string;
  reference: string; referenceValue: string; referenceN: string; referenceVersion: string; difference: string;
}
export function exportRows(dataset: StudioDataset, settings: StudioSettings, anonymize: boolean): ExportRow[] {
  if (settings.representation === 'table' && settings.includeAllAssessments) return assessmentOptions(dataset.result).flatMap((a) => exportRows(dataset, { ...settings, assessment: a.id, includeAllAssessments: false }, anonymize))
  const rows: ExportRow[] = []
  for (const [index, key] of settings.people.entries()) {
    const person = dataset.result.people.find((p) => p.personKey === key)
    if (!person) continue
    for (const entity of measures(dataset.result, settings)) {
      const all = scopedPoints(dataset.result, key, entity.id, settings)
      const latest = snapshotPoint(dataset.result, key, entity.id, settings)
      const points = settings.lens === 'time' ? all : latest ? [latest] : []
      const reference = referenceFor(dataset, settings, entity.id)
      for (const point of points) rows.push({
        personKey: key, person: anonymize ? `Person ${index + 1}` : person.displayName,
        assessmentId: point.assessmentId, assessment: point.assessmentName, measure: entity.name, level: entity.level, score: score(point.value),
        completed: point.completedAt, campaign: point.campaignTitle, attempt: point.attemptNumber, session: anonymize ? '' : point.sessionId,
        baseline: settings.lens === 'time' ? all[0]?.completedAt ?? '' : '',
        change: settings.lens === 'time' && all.length > 1 ? signed(point.value - all[0].value) : '',
        lower: point.ciLower === null ? '' : score(point.ciLower), upper: point.ciUpper === null ? '' : score(point.ciUpper),
        reference: settings.reference === 'none' ? '' : reference.label,
        referenceValue: reference.value === null ? '' : score(reference.value), referenceN: reference.n === null ? '' : String(reference.n), referenceVersion: reference.version,
        difference: reference.value === null ? '' : signed(point.value - reference.value),
      })
    }
  }
  return rows
}
function csvCell(value: string | number): string {
  let safe = String(value)
  if (typeof value === 'string' && /^[\s\u0000-\u001f]*[=+@-]/.test(safe)) safe = `'${safe}`
  return `"${safe.replace(/"/g, '""')}"`
}
export function buildStudioCsv(dataset: StudioDataset, settings: StudioSettings, anonymize: boolean): string {
  const rows = exportRows(dataset, settings, anonymize)
  const numeric = (value: string) => value === '' ? '' : Number(value)
  const header = ['Source', 'View', 'History start', 'History end', 'Person', 'Assessment', 'Measure', 'Measure type', 'Scaled score (0–100)', 'Completed at (UTC)', 'Campaign', 'Attempt', 'Session ID', 'Baseline date (UTC)', 'Change (points)', 'Interval lower', 'Interval upper', 'Reference', 'Reference score', 'Reference n', 'Reference version / basis', 'Difference from reference (points)']
  return '\uFEFF' + [header, ...rows.map((r) => [dataset.demo ? 'Illustrative demo data' : 'Trajectas', settings.lens, settings.lens === 'time' ? settings.from : '', settings.lens === 'time' ? settings.to : '', r.person, r.assessment, r.measure, r.level, Number(r.score), r.completed, r.campaign, r.attempt, r.session, r.baseline, numeric(r.change), numeric(r.lower), numeric(r.upper), r.reference, numeric(r.referenceValue), numeric(r.referenceN), r.referenceVersion, numeric(r.difference)])].map((r) => r.map(csvCell).join(',')).join('\r\n')
}
export function validateSavedSettings(value: unknown, result: CanvasResult, references: StudioReference[] = []): StudioSettings | null {
  if (!value || typeof value !== 'object') return null
  const s = value as Record<string, unknown>
  if (['assessment', 'campaign', 'from', 'to', 'metric', 'snapshotDetail', 'reference'].some((field) => typeof s[field] !== 'string')) return null
  if (!Array.isArray(s.people) || s.people.length > 8 || s.people.some((p) => typeof p !== 'string')) return null
  if (!Array.isArray(s.timeMeasures) || s.timeMeasures.length > 6 || s.timeMeasures.some((m) => typeof m !== 'string')) return null
  if (s.lens !== 'snapshot' && s.lens !== 'time' || s.representation !== 'chart' && s.representation !== 'table' || s.valueMode !== 'score' && s.valueMode !== 'difference') return null
  if (typeof s.showIntervals !== 'boolean' || typeof s.includeAllAssessments !== 'boolean') return null
  if (![s.from, s.to].every((d) => {
    if (d === '') return true
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d as string)) return false
    const date = new Date(`${d}T00:00:00Z`)
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === d
  })) return null
  if (!assessmentOptions(result).some((a) => a.id === s.assessment)) return null
  if (s.campaign !== 'all' && !campaignOptions(result).some((c) => c.id === s.campaign)) return null
  const available = measures(result, { assessment: s.assessment as string })
  if (!available.some((m) => m.id === s.metric) || (s.timeMeasures as string[]).some((id) => !available.some((m) => m.id === id))) return null
  if (s.snapshotDetail !== 'overview' && !available.some((m) => m.id === s.snapshotDetail && m.level === 'dimension')) return null
  if (!s.snapshotSelections || typeof s.snapshotSelections !== 'object' || Array.isArray(s.snapshotSelections)) return null
  const selections: StudioSettings['snapshotSelections'] = {}
  for (const person of result.people) for (const assessment of assessmentOptions(result)) {
    const key = snapshotKey(person.personKey, assessment.id)
    const id = (s.snapshotSelections as Record<string, unknown>)[key]
    if (id !== undefined && id !== null && typeof id !== 'string') return null
    if (typeof id === 'string' && !uniqueSessions(result, person.personKey).some((p) => p.assessmentId === assessment.id && p.sessionId === id)) return null
    selections[key] = typeof id === 'string' ? id : null
  }
  const keys = new Set(result.people.map((p) => p.personKey))
  const people = [...new Set(s.people as string[])].filter((p) => keys.has(p))
  const reference = s.reference === 'group' && people.length >= 2 || s.reference === 'none' || references.some((r) => r.id === s.reference && r.assessmentId === s.assessment && r.version) ? s.reference as string : 'none'
  return { ...s, reference, valueMode: reference === 'none' ? 'score' : s.valueMode, people, timeMeasures: [...new Set(s.timeMeasures as string[])], snapshotSelections: selections } as StudioSettings
}
