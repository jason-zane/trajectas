import { describe, expect, it } from 'vitest'
import { OVERALL_ID } from '@/lib/canvas/types'
import { createStudioDemo } from '@/lib/trajectory-studio/demo'
import { assessmentOptions, buildStudioCsv, changeFor, currentPoint, exportRows, groupMean, initialSettings, measures, referenceFor, referenceOptions, scopedPoints, selectCampaign, snapshotKey, snapshotPoint, snapshotSession, trajectorySeries, uniqueSessions, validateSavedSettings } from '@/lib/trajectory-studio/model'

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

  it('scopes history by inclusive UTC dates without changing snapshot results', () => {
    const window = { ...settings, from: '2025-12-04', to: '2026-03-19' }
    const points = scopedPoints(result, priya, OVERALL_ID, window)
    expect(points.map((p) => p.value)).toEqual([64, 62])
    expect(currentPoint(result, priya, OVERALL_ID, { ...window, lens: 'time' })?.value).toBe(62)
    expect(snapshotPoint(result, priya, OVERALL_ID, window)?.value).toBe(77)
  })

  it('filters campaign sessions while preserving identity across campaigns', () => {
    const campaign = { ...settings, campaign: 'development-2025' }
    expect(scopedPoints(result, priya, OVERALL_ID, campaign).map((p) => p.value)).toEqual([57, 64])
    expect(snapshotSession(result, priya, campaign)?.attemptNumber).toBe(4)
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

  it('empty and reversed history windows never alter the pinned snapshot', () => {
    expect(scopedPoints(result, priya, OVERALL_ID, { ...settings, to: '2025-09-16' })).toEqual([])
    expect(snapshotSession(result, priya, { ...settings, to: '2025-09-16' })?.attemptNumber).toBe(4)
    expect(scopedPoints(result, priya, OVERALL_ID, { ...settings, from: '2026-09-01', to: '2025-01-01' })).toEqual([])
    expect(snapshotSession(result, priya, { ...settings, from: '2026-09-01', to: '2025-01-01' })?.attemptNumber).toBe(4)
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
    expect(validateSavedSettings({ ...settings, from: '2026-02-30' }, dataset.result)).toBeNull()
    expect(validateSavedSettings(null, dataset.result)).toBeNull()
  })
})


describe('Explicit campaign results, references and chart semantics', () => {
  const dataset = createStudioDemo()
  const result = dataset.result
  const settings = initialSettings(result, 'compare')
  const priya = 'demo-person-1'

  it('selects one campaign for the group, including explicit missing results', () => {
    const earlier = { ...settings, snapshotSelections: selectCampaign(result, settings, 'development-2025') }
    expect(snapshotPoint(result, priya, OVERALL_ID, earlier)?.value).toBe(64)
    expect(groupMean(result, OVERALL_ID, earlier)).toEqual({ value: 69, n: 4 })
    const hiring = { ...settings, snapshotSelections: selectCampaign(result, settings, 'leadership-hiring') }
    expect(snapshotSession(result, priya, hiring)).toBeNull()
    expect(groupMean(result, OVERALL_ID, hiring)).toEqual({ value: null, n: 0 })
  })

  it('uses the exact chosen attempt without changing another person or instrument', () => {
    const custom = { ...settings, snapshotSelections: { ...settings.snapshotSelections, [snapshotKey(priya, settings.assessment)]: 'demo-person-1-leadership-0' } }
    expect(snapshotPoint(result, priya, OVERALL_ID, custom)?.value).toBe(57)
    expect(snapshotPoint(result, 'demo-person-2', OVERALL_ID, custom)?.value).toBe(82)
    expect(snapshotSession(result, priya, { ...custom, assessment: 'workplace-styles' })?.sessionId).toBe('demo-person-1-styles-1')
    expect(groupMean(result, OVERALL_ID, custom)).toEqual({ value: 71, n: 4 })
  })

  it('never falls back when a saved snapshot result disappears', () => {
    const removed = structuredClone(result)
    removed.series.forEach((s) => { s.points = s.points.filter((p) => p.sessionId !== 'demo-person-1-leadership-3') })
    expect(snapshotSession(removed, priya, settings)).toBeNull()
  })

  it('calculates each group mean from available scores and unique people only', () => {
    expect(groupMean(result, OVERALL_ID, settings)).toEqual({ value: 76, n: 4 })
    expect(groupMean(result, 'factor-4-2', settings).n).toBe(3)
    expect(groupMean(result, OVERALL_ID, { ...settings, people: [priya, priya] })).toEqual({ value: null, n: 1 })
    expect(groupMean(result, 'style-0', settings)).toEqual({ value: null, n: 0 })
    const styles = { ...settings, assessment: 'workplace-styles' }
    expect(groupMean(result, 'style-0', styles).n).toBe(3)
  })

  it('shows several measures for one person and one measure for several people', () => {
    const own = initialSettings(result, 'individual')
    const single = trajectorySeries(dataset, own)
    expect(single).toHaveLength(5)
    expect(new Set(single.map((s) => s.personKey))).toEqual(new Set([priya]))
    expect(single.every((s) => s.points.length === 4)).toBe(true)
    const group = trajectorySeries(dataset, { ...own, people: settings.people, metric: 'dimension-1' })
    expect(group).toHaveLength(4)
    expect(new Set(group.map((s) => s.entityId))).toEqual(new Set(['dimension-1']))
  })

  it('holds a chosen reference fixed across history and never mixes instruments', () => {
    const own = { ...initialSettings(result, 'individual'), reference: 'example-leaders' }
    expect(referenceFor(dataset, own, 'dimension-0')).toMatchObject({ value: 67, n: 240, version: 'Illustrative 2026.1' })
    expect(referenceFor(dataset, { ...own, from: '2026-03-19' }, 'dimension-0').value).toBe(67)
    expect(referenceFor(dataset, { ...own, assessment: 'workplace-styles' }, 'dimension-0').value).toBeNull()
    expect(referenceOptions({ ...dataset, demo: false }, own)).toEqual([])
    expect(referenceFor(dataset, { ...own, reference: 'example-target' }, 'factor-0-0').value).toBeNull()
  })

  it('rejects unversioned values and invalid norm samples', () => {
    const altered = structuredClone(dataset)
    altered.references![0].version = ''
    expect(referenceFor(altered, { ...settings, reference: 'example-leaders' }, 'dimension-0').value).toBeNull()
    altered.references![0].version = 'example'
    altered.references![0].values['dimension-0'].n = 1
    expect(referenceFor(altered, { ...settings, reference: 'example-leaders' }, 'dimension-0').value).toBeNull()
    altered.references![0].values['dimension-0'] = { value: Number.NaN, n: 240 }
    expect(referenceFor(altered, { ...settings, reference: 'example-leaders' }, 'dimension-0').value).toBeNull()
  })

  it('exports the same reference values, sample sizes and differences as the view', () => {
    const rows = exportRows(dataset, settings, false).filter((r) => r.measure === 'Overall score')
    expect(rows.map((r) => r.referenceValue)).toEqual(['76', '76', '76', '76'])
    expect(rows.map((r) => r.referenceN)).toEqual(['4', '4', '4', '4'])
    expect(rows.map((r) => r.difference)).toEqual(['+1', '+6', '-2', '-5'])
    const own = exportRows(dataset, { ...initialSettings(result, 'individual'), reference: 'example-leaders' }, false).filter((r) => r.measure === 'Thinking')
    expect(own.map((r) => r.referenceValue)).toEqual(['67', '67', '67', '67'])
    expect(own.map((r) => r.difference)).toEqual(['-12', '-5', '-7', '+8'])
    const csv = buildStudioCsv(dataset, settings, false)
    expect(csv).toContain('Difference from reference (points)')
    expect(csv).not.toContain('"2025-09-17","2026-08-27"')
  })

  it('preserves snapshot sources and measures when saving; rejects cross-person attempts', () => {
    const valid = validateSavedSettings(settings, result)
    expect(valid?.snapshotSelections).toEqual(settings.snapshotSelections)
    expect(valid?.timeMeasures).toEqual(settings.timeMeasures)
    expect(validateSavedSettings({ ...settings, snapshotSelections: { ...settings.snapshotSelections, [snapshotKey(priya, settings.assessment)]: 'demo-person-2-leadership-3' } }, result)).toBeNull()
    expect(validateSavedSettings({ ...settings, timeMeasures: ['style-0'] }, result)).toBeNull()
    expect(validateSavedSettings({ ...settings, reference: 'removed-reference', valueMode: 'difference' }, result)?.reference).toBe('none')
  })
})
