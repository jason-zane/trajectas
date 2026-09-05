import { describe, expect, it } from 'vitest'
import { OVERALL_ID } from '@/lib/canvas/types'
import { createStudioDemo } from '@/lib/trajectory-studio/demo'
import { assessmentOptions, buildStudioCsv, changeFor, exportRows, initialSettings, measures, scopedPoints, snapshotPoint, snapshotSession, uniqueSessions, validateSavedSettings } from '@/lib/trajectory-studio/model'

describe('Trajectory studio: assessment, identity and time boundaries', () => {
  const dataset = createStudioDemo()
  const result = dataset.result
  const settings = initialSettings(result, 'compare')
  const priya = 'demo-person-1'

  it('keeps independent instruments separate and does not create a preference composite', () => {
    expect(assessmentOptions(result).map((a) => a.id)).toEqual(['leadership-index', 'workplace-styles'])
    const style = { ...settings, assessment: 'workplace-styles' }
    expect(scopedPoints(result, priya, OVERALL_ID, style)).toEqual([])
    expect(measures(result, style).map((m) => m.name)).toEqual(['Collaboration preference', 'Structure preference', 'Exploration preference'])
  })

  it('starts on a real measure when an assessment has no overall score', () => {
    const stylesOnly = { ...result, series: result.series.map((series) => ({ ...series, points: series.points.filter((point) => point.assessmentId === 'workplace-styles') })).filter((series) => series.points.length) }
    expect(initialSettings(stylesOnly, 'individual').metric).toBe('style-0')
  })

  it('uses the latest completed attempt within an inclusive UTC date window', () => {
    const window = { ...settings, from: '2025-12-04', to: '2026-03-19' }
    const points = scopedPoints(result, priya, OVERALL_ID, window)
    expect(points.map((p) => p.value)).toEqual([64, 62])
    expect(snapshotPoint(result, priya, OVERALL_ID, window)?.value).toBe(62)
  })

  it('filters campaign sessions while preserving identity across campaigns', () => {
    const campaign = { ...settings, campaign: 'development-2025' }
    expect(scopedPoints(result, priya, OVERALL_ID, campaign).map((p) => p.value)).toEqual([57, 64])
    expect(snapshotSession(result, priya, campaign)?.attemptNumber).toBe(2)
  })

  it('never backfills a missing factor from an older attempt into a snapshot', () => {
    const person = 'demo-person-4'
    expect(scopedPoints(result, person, 'factor-4-2', settings)).toHaveLength(3)
    expect(snapshotSession(result, person, settings)?.attemptNumber).toBe(4)
    expect(snapshotPoint(result, person, 'factor-4-2', settings)).toBeNull()
  })

  it('returns missing results rather than zeros for an uncompleted assessment', () => {
    expect(snapshotPoint(result, 'demo-person-3', 'style-0', { ...settings, assessment: 'workplace-styles' })).toBeNull()
  })

  it('excludes future attempts and handles empty or reversed windows', () => {
    expect(snapshotSession(result, priya, { ...settings, to: '2025-09-16' })).toBeNull()
    expect(scopedPoints(result, priya, OVERALL_ID, { ...settings, from: '2026-09-01', to: '2025-01-01' })).toEqual([])
    expect(snapshotSession(result, priya, { ...settings, from: '2026-09-01', to: '2025-01-01' })).toBeNull()
  })

  it('deduplicates sessions across all measured dimensions and factors', () => {
    expect(uniqueSessions(result, priya)).toHaveLength(6)
    expect(uniqueSessions(result, priya).map((p) => p.completedAt)).toEqual(uniqueSessions(result, priya).map((p) => p.completedAt).sort())
  })

  it('preserves a dip and requires two observations to report a change', () => {
    const points = scopedPoints(result, priya, OVERALL_ID, settings)
    expect(points.map((p) => p.value)).toEqual([57, 64, 62, 77])
    expect(changeFor(points)).toBe(20)
    expect(changeFor(points.slice(1, 3))).toBe(-2)
    expect(changeFor(points.slice(0, 1))).toBeNull()
    expect(changeFor([])).toBeNull()
  })
})

describe('Trajectory exports and saved state', () => {
  const dataset = createStudioDemo()
  const settings = initialSettings(dataset.result, 'compare')

  it('exports only selected people and the exact snapshot attempts shown', () => {
    const rows = exportRows(dataset, { ...settings, people: ['demo-person-4'] }, false)
    expect(rows.every((r) => r.person === 'Sofia Chen' && r.assessment === 'Leadership Index' && r.attempt === 4)).toBe(true)
    expect(rows.some((r) => r.measure === 'Self-awareness')).toBe(false)
    expect(rows.every((r) => !r.change && !r.baseline)).toBe(true)
  })

  it('exports dated observations and score-point changes from the chosen baseline', () => {
    const rows = exportRows(dataset, { ...settings, people: ['demo-person-1'], lens: 'time', from: '2025-12-04' }, false).filter((r) => r.measure === 'Overall score')
    expect(rows.map((r) => r.score)).toEqual(['64', '62', '77'])
    expect(rows.map((r) => r.change)).toEqual(['0', '-2', '+13'])
    expect(rows.every((r) => r.baseline.startsWith('2025-12-04'))).toBe(true)
  })

  it('keeps multi-assessment matrix exports in separate assessment bases', () => {
    const all = { ...settings, representation: 'table' as const, includeAllAssessments: true }
    const rows = exportRows(dataset, all, false)
    expect(new Set(rows.map((r) => r.assessment))).toEqual(new Set(['Leadership Index', 'Workplace styles']))
    expect(rows.filter((r) => r.assessment === 'Workplace styles').every((r) => r.measure !== 'Overall score')).toBe(true)
    expect(exportRows(dataset, { ...all, representation: 'chart' }, false).every((r) => r.assessment === 'Leadership Index')).toBe(true)
  })

  it('omits personal names and session identifiers when anonymized', () => {
    const csv = buildStudioCsv(dataset, settings, true)
    expect(csv).toContain('Person 1')
    expect(csv).not.toContain('Priya')
    expect(csv).not.toContain('demo-person')
    expect(csv).not.toContain('@example.test')
    expect(csv).toContain('Illustrative demo data')
  })

  it('escapes quotes, line breaks, and spreadsheet formulas in exported text', () => {
    const altered = structuredClone(dataset)
    altered.result.people[0].displayName = ' \t=HYPERLINK("untrusted")\nName'
    const csv = buildStudioCsv(altered, settings, false)
    expect(csv).toContain('"\' \t=HYPERLINK(""untrusted"")\nName"')
    expect(csv.startsWith('\uFEFF')).toBe(true)
  })

  it('keeps same-name people separate and change columns numeric', () => {
    const sameName = structuredClone(dataset)
    sameName.result.people[1].displayName = sameName.result.people[0].displayName
    const rows = exportRows(sameName, settings, false)
    expect(rows.filter((row) => row.personKey === 'demo-person-1' && row.measure === 'Overall score')[0].score).toBe('77')
    expect(rows.filter((row) => row.personKey === 'demo-person-2' && row.measure === 'Overall score')[0].score).toBe('82')
    const csv = buildStudioCsv(dataset, { ...settings, lens: 'time', from: '2025-12-04' }, false)
    expect(csv).toContain(',"-2",')
    expect(csv).not.toContain("'-2")
    expect(csv).toContain('Measure type')
  })

  it('validates saved selections against the current dataset', () => {
    expect(validateSavedSettings({ ...settings, people: ['missing', 'demo-person-1', 'demo-person-1'] }, dataset.result)?.people).toEqual(['demo-person-1'])
    expect(validateSavedSettings({ ...settings, assessment: 'missing' }, dataset.result)).toBeNull()
    expect(validateSavedSettings({ ...settings, lens: 'unexpected' }, dataset.result)).toBeNull()
    expect(validateSavedSettings({ ...settings, people: Array(9).fill('demo-person-1') }, dataset.result)).toBeNull()
    expect(validateSavedSettings({ ...settings, from: 'invalid' }, dataset.result)).toBeNull()
    expect(validateSavedSettings(null, dataset.result)).toBeNull()
  })
})
