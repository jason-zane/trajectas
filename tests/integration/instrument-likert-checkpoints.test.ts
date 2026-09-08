import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { createBuild, createBlueprint, replaceBlueprintCells, createCandidateItem, recordStageRun, claimStageRun, getCandidateItem, updateCandidateItem, updateBuild, updateBlueprint, getBuild, listStageRuns, listCandidateItems } from '@/lib/dal/instrument'
import { commitLikertStep, expireLikertStep, likertSpecSnapshot, listLikertFormats } from '@/lib/dal/instrument-likert'
import { advanceLikert, getLikertStatus, loadLikertContext } from '@/lib/instrument/likert/pipeline'
import { fingerprint, itemFingerprint } from '@/lib/instrument/likert/identity'
import { PAIR_REVIEW_VERSION } from '@/lib/instrument/likert/form-review'
import { OpenRouterProvider } from '@/lib/ai/providers/openrouter'
import { LIKERT_STAGE, LIKERT_STEP, LIKERT_VERSION, likertOptionsSchema, type LikertState } from '@/lib/instrument/likert/contracts'

const local = /^http:\/\/(127\.0\.0\.1|localhost):/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
const canRun = local && !!process.env.SUPABASE_SERVICE_ROLE_KEY
const db = canRun ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } }) : null!
const ids: string[] = []
let buildId: string
let itemId: string
let jobId: string
let state: LikertState
let candidate: Record<string, unknown>

describe.skipIf(!canRun)('transactional Likert checkpoints (local database)', () => {
  beforeEach(async () => {
    const build = await createBuild(db, { name: `LIKERT CHECKPOINT ${randomUUID()}`, measureType: 'trait' })
    buildId = build.id; ids.push(buildId)
    const bp = await createBlueprint(db, { buildId, measureType: 'trait', draftConstructName: 'Dependability', draftConstructDefinition: 'Following through on agreed commitments.' })
    const cells = await replaceBlueprintCells(db, bp.id, [{ facetLabel: 'Follow-through', facetDefinition: 'Completing agreed actions.', intensity: 'mid', targetItemCount: 4, displayOrder: 0 }])
    const item = await createCandidateItem(db, { buildId, blueprintCellId: cells[0].id, stem: 'I finish tasks by the date I agreed to.', reverseScored: false })
    itemId = item.id
    candidate = { ...item, stem: 'I complete the work I agree to do.', status: 'candidate', payload: {} }
    state = { version: LIKERT_VERSION, revision: 0, options: likertOptionsSchema.parse({}), models: { writer: 'a/a', blueprint: 'b/b', reviewers: ['a/a', 'b/b', 'c/c'] }, phase: 'review', round: 0, selectedIds: [], failures: 0, calls: 0, detail: 'Fixture', blockers: [], generationCounts: {} }
    jobId = (await recordStageRun(db, { buildId, stageKey: LIKERT_STAGE, status: 'pending', outputSnapshot: { ...state } })).id
  })
  afterAll(async () => {
    for (const id of ids) { const { error } = await db.from('instrument_builds').delete().eq('id', id); if (error) throw error }
  })
  const claim = () => claimStageRun(db, { buildId, stageKey: LIKERT_STEP, startedAt: new Date().toISOString() })
  const commit = async (stepId: string, snapshot: Record<string, unknown>, changes = [candidate]) => commitLikertStep(db, { jobId, stepId, revision: 0, expectedSpec: snapshot, state: { ...state, revision: 1 }, candidates: changes })

  it('allows exactly one of twelve racing requests to claim a step', async () => {
    const results = await Promise.allSettled(Array.from({ length: 12 }, claim))
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
  })
  it('commits candidate and job atomically; lost-response replay cannot duplicate changes', async () => {
    const lease = await claim(); const snapshot = await likertSpecSnapshot(db, buildId)
    await commit(lease.id, snapshot)
    expect((await getCandidateItem(db, itemId))?.stem).toBe(candidate.stem)
    await expect(commit(lease.id, snapshot)).rejects.toThrow(/lease|changed/)
    expect((await listStageRuns(db, buildId)).find(run => run.id === jobId)?.outputSnapshot?.revision).toBe(1)
  })
  it('rejects a stale reviewer when an item was edited, with no partial job update', async () => {
    const lease = await claim(); const snapshot = await likertSpecSnapshot(db, buildId)
    await updateCandidateItem(db, itemId, { stem: 'A newer manually edited statement.' })
    await expect(commit(lease.id, snapshot)).rejects.toThrow(/Item changed/)
    expect((await getCandidateItem(db, itemId))?.stem).toBe('A newer manually edited statement.')
    expect((await listStageRuns(db, buildId)).find(run => run.id === jobId)?.outputSnapshot?.revision).toBe(0)
  })
  it('invalidates an in-flight result when the audience or specification changes', async () => {
    const lease = await claim(); const snapshot = await likertSpecSnapshot(db, buildId)
    await updateBuild(db, buildId, { audience: { level: 'entry' } })
    await expect(commit(lease.id, snapshot)).rejects.toThrow(/Specification changed/)
    expect((await getBuild(db, buildId))?.audience).toEqual({ level: 'entry' })
  })
  it('reclaims an expired lease and fences its delayed completion', async () => {
    const expired = await claim(); const snapshot = await likertSpecSnapshot(db, buildId)
    const { error } = await db.from('instrument_stage_runs').update({ started_at: new Date(Date.now() - 181_000).toISOString() }).eq('id', expired.id)
    expect(error).toBeNull()
    await expireLikertStep(db, buildId)
    const replacement = await claim()
    await expect(commit(expired.id, snapshot)).rejects.toThrow(/lease expired/)
    await commit(replacement.id, snapshot)
  })
  it('fences a worker if publication starts after its initial read', async () => {
    const lease = await claim(); const snapshot = await likertSpecSnapshot(db, buildId)
    await claimStageRun(db, { buildId, stageKey: 'publish_readiness', startedAt: new Date().toISOString() })
    await expect(commit(lease.id, snapshot)).rejects.toThrow(/Publication is in progress/)
    expect((await listStageRuns(db, buildId)).find(run => run.id === jobId)?.outputSnapshot?.revision).toBe(0)
  })
  it('does not rewrite a published instrument even with a current step claim', async () => {
    const lease = await claim(); const snapshot = await likertSpecSnapshot(db, buildId)
    await updateBuild(db, buildId, { status: 'published' })
    await expect(commit(lease.id, snapshot)).rejects.toThrow(/Published instruments cannot/)
  })
  it('resumes the failed blueprint stage and redrafts facets after a construct definition changes', async () => {
    const formats = await listLikertFormats(db)
    expect(formats.length).toBeGreaterThan(0)
    const options = likertOptionsSchema.parse({ itemsPerConstruct: 4, responseFormatId: formats[0].id })
    await updateBuild(db, buildId, { config: { likert: options } })
    await db.from('instrument_stage_runs').update({ output_snapshot: { ...state, options, phase: 'blueprint' } }).eq('id', jobId)
    const provider = vi.spyOn(OpenRouterProvider.prototype, 'complete').mockRejectedValue(new Error('Fixture provider outage'))
    try {
      for (let i = 0; i < 3; i++) await expect(advanceLikert(db, buildId)).rejects.toThrow(/Fixture provider outage/)
      const stopped = (await listStageRuns(db, buildId)).find(run => run.id === jobId)?.outputSnapshot
      expect(stopped).toMatchObject({ phase: 'incomplete', resumePhase: 'blueprint', failures: 3 })
      provider.mockImplementation(async request => ({ content: JSON.stringify({ facets: [{ label: 'Agreed actions', definition: 'Completes agreed actions without reminders.' }, { label: 'Timely completion', definition: 'Finishes agreed tasks by the promised time.' }] }), model: request.model!, provider: 'custom', usage: { inputTokens: 10, outputTokens: 10 } }))
      expect((await advanceLikert(db, buildId, true)).detail).toContain('Operational blueprint created')
      expect((await advanceLikert(db, buildId)).phase).toBe('generate')
      const { data } = await db.from('instrument_blueprints').select('id').eq('build_id', buildId).single()
      const { data: currentCells } = await db.from('instrument_blueprint_cells').select('intensity,target_item_count').eq('blueprint_id', data!.id).is('retired_at', null)
      expect(currentCells).toHaveLength(2)
      expect(currentCells?.every(cell => cell.intensity === 'mid')).toBe(true)
      expect(currentCells?.reduce((sum, cell) => sum + cell.target_item_count, 0)).toBe(4)
      await updateBlueprint(db, data!.id, { draftConstructDefinition: 'Adapting work methods when requirements change.' })
      expect((await advanceLikert(db, buildId)).detail).toContain('Operational blueprint created')
      expect(provider).toHaveBeenCalledTimes(7)
    } finally { provider.mockRestore() }
  })
  it('simplifies difficult wording before independent review without granting acceptance', async () => {
    const formats = await listLikertFormats(db)
    const options = likertOptionsSchema.parse({ itemsPerConstruct: 4, readingLevel: 'entry', responseFormatId: formats[0].id })
    await updateBuild(db, buildId, { config: { likert: options } })
    await db.from('instrument_stage_runs').update({ output_snapshot: { ...state, options, phase: 'generate' } }).eq('id', jobId)
    const intents = ['small task follow-through', 'meeting agreed dates', 'keeping work promises', 'finishing started tasks', 'meeting agreed work standards'].map((focus, index) => ({ index, focus, condition: 'No special condition', distinction: `Distinct fixture content ${index}`, reverseScored: index === 0 }))
    const drafts = ['one', 'two', 'three', 'four', 'five'].map((word, index) => ({ intentIndex: index, stem: `Over the past three months, I comprehensively operationalized sophisticated organizational responsibilities while simultaneously accommodating unpredictable circumstances in circumstance ${word}.`, reverseScored: index === 0, rationale: 'A specific agreed work commitment.', replacesId: null }))
    const simplified = [
      'Think of the past three months. I forgot small work tasks.',
      'Think of the past three months. I met agreed dates.',
      'Think of the past three months. I kept my work promises.',
      'Think of the past three months. I finished tasks I started.',
      'Think of the past three months. I did work as agreed.',
    ]
    const provider = vi.spyOn(OpenRouterProvider.prototype, 'complete').mockImplementation(async request => ({
      model: request.model!, provider: 'custom', usage: { inputTokens: 10, outputTokens: 10 },
      content: JSON.stringify(request.prompt.startsWith('Plan the content') ? { intents, coverageBlocker: null } : { items: request.prompt.startsWith('Write or repair') ? drafts : simplified.map((stem, index) => ({ index, stem })) }),
    }))
    try {
      await advanceLikert(db, buildId)
      expect(await listCandidateItems(db, buildId)).toHaveLength(1)
      const planned = (await listStageRuns(db, buildId)).find(run => run.id === jobId)?.outputSnapshot
      expect(planned?.generationPlan).toMatchObject({ model: 'b/b', intents })
      expect(planned?.generationCounts).toEqual({})
      await advanceLikert(db, buildId)
      const saved = await listCandidateItems(db, buildId)
      expect(saved.filter(item => simplified.includes(item.stem))).toHaveLength(5)
      expect(saved.some(item => item.status === 'accepted')).toBe(false)
      expect(saved.some(item => item.payload?.likertQuality)).toBe(false)
      expect(saved.find(item => item.stem === simplified[0])?.payload?.likertGeneration).toMatchObject({ planner: 'b/b', intent: intents[0] })
      expect(provider).toHaveBeenCalledTimes(3)
      expect(provider.mock.calls[0][0].model?.split('/')[0]).not.toBe(provider.mock.calls[1][0].model?.split('/')[0])
    } finally { provider.mockRestore() }
  })
  it('keeps an explicit planning coverage blocker as repair evidence without inventing candidates', async () => {
    const options = likertOptionsSchema.parse({ itemsPerConstruct: 4, responseFormatId: (await listLikertFormats(db))[0].id })
    await updateBuild(db, buildId, { config: { likert: options } })
    await db.from('instrument_stage_runs').update({ output_snapshot: { ...state, options, phase: 'generate', round: 5 } }).eq('id', jobId)
    const reason = 'This narrow facet cannot support more distinct manifestations without importing another construct.'
    const provider = vi.spyOn(OpenRouterProvider.prototype, 'complete').mockImplementation(async request => ({ model: request.model!, provider: 'custom', usage: { inputTokens: 10, outputTokens: 10 }, content: JSON.stringify({ intents: [], coverageBlocker: reason }) }))
    try {
      await advanceLikert(db, buildId)
      expect(await listCandidateItems(db, buildId)).toHaveLength(1)
      const planned = (await listStageRuns(db, buildId)).find(run => run.id === jobId)?.outputSnapshot as unknown as LikertState
      expect(Object.values(planned.planningFeedback!)).toEqual([reason])
      expect(planned.generationPlan).toBeUndefined()
      // The exhausted content round reaches the existing one-per-construct redesign.
      await db.from('instrument_stage_runs').update({ output_snapshot: { ...planned, phase: 'select' } }).eq('id', jobId)
      expect((await advanceLikert(db, buildId)).phase).toBe('blueprint')
      const repaired = (await listStageRuns(db, buildId)).find(run => run.id === jobId)?.outputSnapshot as unknown as LikertState
      expect(JSON.stringify(repaired.blueprintFeedback)).toContain(reason)
      expect(repaired.blueprintRepairs).toBe(1)
      expect(provider).toHaveBeenCalledTimes(1)
    } finally { provider.mockRestore() }
  })
  it('automatically returns to blueprint design once when item repair budgets cannot satisfy coverage', async () => {
    const formats = await listLikertFormats(db)
    const options = likertOptionsSchema.parse({ itemsPerConstruct: 4, responseFormatId: formats[0].id })
    await updateBuild(db, buildId, { config: { likert: options } })
    await db.from('instrument_stage_runs').update({ output_snapshot: { ...state, options, phase: 'select', round: 5 } }).eq('id', jobId)
    const provider = vi.spyOn(OpenRouterProvider.prototype, 'complete').mockRejectedValue(new Error('No AI call should be needed for a transition'))
    try {
      expect((await advanceLikert(db, buildId)).phase).toBe('blueprint')
      const checkpoint = (await listStageRuns(db, buildId)).find(run => run.id === jobId)?.outputSnapshot
      expect(checkpoint).toMatchObject({ blueprintRepairs: 1, round: 0 })
      await db.from('instrument_stage_runs').update({ output_snapshot: { ...checkpoint, phase: 'select', round: 5 } }).eq('id', jobId)
      expect((await advanceLikert(db, buildId)).phase).toBe('incomplete')
      expect(provider).not.toHaveBeenCalled()
    } finally { provider.mockRestore() }
  })
  it('records a failed build without issuing model calls when the call budget is exhausted', async () => {
    const formats = await listLikertFormats(db)
    const options = likertOptionsSchema.parse({ itemsPerConstruct: 4, responseFormatId: formats[0].id })
    await updateBuild(db, buildId, { config: { likert: options } })
    await db.from('instrument_stage_runs').update({ output_snapshot: { ...state, options, phase: 'generate', calls: 600 } }).eq('id', jobId)
    const provider = vi.spyOn(OpenRouterProvider.prototype, 'complete').mockRejectedValue(new Error('Budget must stop this call'))
    try {
      expect((await advanceLikert(db, buildId)).phase).toBe('incomplete')
      expect((await getBuild(db, buildId))?.status).toBe('failed')
      expect(provider).not.toHaveBeenCalled()
    } finally { provider.mockRestore() }
  })
  it('allows a later failing construct its own single redesign without reopening an earlier repair budget', async () => {
    const formats = await listLikertFormats(db)
    const options = likertOptionsSchema.parse({ itemsPerConstruct: 4, responseFormatId: formats[0].id })
    await updateBuild(db, buildId, { config: { likert: options } })
    const { data: first } = await db.from('instrument_blueprints').select('id').eq('build_id', buildId).single()
    const second = await createBlueprint(db, { buildId, measureType: 'trait', draftConstructName: 'Sociability', draftConstructDefinition: 'Seeking and enjoying informal social interaction.' })
    await replaceBlueprintCells(db, second.id, [{ facetLabel: 'Social contact', facetDefinition: 'Initiating informal contact with other people.', intensity: 'mid', targetItemCount: 4, displayOrder: 0 }])
    // The saved feedback also identifies previously repaired constructs in older checkpoints.
    await db.from('instrument_stage_runs').update({ output_snapshot: { ...state, options, phase: 'select', round: 5, blueprintRepairs: 1, blueprintFeedback: { [first!.id]: {} } } }).eq('id', jobId)
    const provider = vi.spyOn(OpenRouterProvider.prototype, 'complete').mockRejectedValue(new Error('No model call is needed for this transition'))
    try {
      expect((await advanceLikert(db, buildId)).phase).toBe('blueprint')
      const checkpoint = (await listStageRuns(db, buildId)).find(run => run.id === jobId)?.outputSnapshot
      expect(checkpoint?.blueprintRepairIds).toEqual([first!.id, second.id])
      expect(Object.keys(checkpoint?.blueprintFeedback as object)).toEqual([second.id])
      await db.from('instrument_stage_runs').update({ output_snapshot: { ...checkpoint, phase: 'select', round: 5 } }).eq('id', jobId)
      expect((await advanceLikert(db, buildId)).phase).toBe('incomplete')
      expect(provider).not.toHaveBeenCalled()
    } finally { provider.mockRestore() }
  })
  it.each([true, false])('handles a reviewer contradiction per item, including when self-correction succeeds=%s', async fixesIt => {
    const formats = await listLikertFormats(db)
    const options = likertOptionsSchema.parse({ itemsPerConstruct: 4, responseFormatId: formats[0].id })
    await updateBuild(db, buildId, { config: { likert: options } })
    await db.from('instrument_stage_runs').update({ output_snapshot: { ...state, options, phase: 'review' } }).eq('id', jobId)
    let thirdReviewerCalls = 0
    const provider = vi.spyOn(OpenRouterProvider.prototype, 'complete').mockImplementation(async request => {
      const inconsistent = request.model === 'c/c' && (++thirdReviewerCalls === 1 || !fixesIt)
      return { model: request.model!, provider: 'custom', usage: { inputTokens: 10, outputTokens: 10 }, content: JSON.stringify({ items: [{ id: 'item-1', constructId: 'construct-1', facetLabel: 'Follow-through', relevance: 4, clarity: 4, reverseScored: false, lowTypicalHigh: inconsistent ? [5, 3, 1] : [1, 3, 5], paraphrase: 'Recall completion of agreed work.', issues: [], rationale: 'Completing agreed work reflects follow-through.' }] }) }
    })
    try {
      const status = await advanceLikert(db, buildId)
      expect(status.phase).toBe('review')
      expect(status.passed).toBe(fixesIt ? 1 : 0)
      expect(thirdReviewerCalls).toBe(2)
      expect((await getCandidateItem(db, itemId))?.payload?.likertQuality).toMatchObject({ pass: fixesIt })
    } finally { provider.mockRestore() }
  })
  it.each(['corrected', 'retained', 'interrupted'])('self-checks disputed pairs once and preserves unresolved concerns: %s', async mode => {
    const formats = await listLikertFormats(db)
    const options = likertOptionsSchema.parse({ itemsPerConstruct: 4, reverseProportion: 0, responseFormatId: formats[0].id })
    await updateBuild(db, buildId, { config: { likert: options } })
    const { spec } = await loadLikertContext(db, buildId)
    const construct = spec.constructs[0]
    for (const stem of ['I check which work is due next.', 'I write down the tasks I agree to do.', 'I tell others when my work is done.']) await createCandidateItem(db, { buildId, blueprintCellId: construct.cells[0].id, stem, reverseScored: false })
    const items = (await listCandidateItems(db, buildId)).sort((a, b) => a.id.localeCompare(b.id))
    for (const item of items) await updateCandidateItem(db, item.id, { payload: { likertQuality: {
      version: LIKERT_VERSION, specHash: fingerprint(spec), itemHash: itemFingerprint(item), reviewedAt: new Date().toISOString(), pass: true, reasons: [], score: 4, correctedKey: false, readingGrade: 4,
      reviews: state.models.reviewers.map(model => ({ model, id: item.id, constructId: construct.id, facetLabel: construct.cells[0].facetLabel, relevance: 4, clarity: 4, reverseScored: false, lowTypicalHigh: [1, Math.ceil(spec.format.points / 2), spec.format.points], paraphrase: 'Recall an agreed action.', issues: [], rationale: 'This tests the publication and pair-review mechanism.' })),
    } } })
    const models = ['b/b', 'c/c']
    const prepared: LikertState = { ...state, options, phase: 'form_review', specHash: fingerprint(spec), selectedIds: items.map(item => item.id), diversity: { [construct.id]: { models, model: models.join(', '), pairs: [], contentHash: fingerprint(items.map(item => ({ id: item.id, hash: itemFingerprint(item) }))) } } }
    await db.from('instrument_stage_runs').update({ output_snapshot: prepared }).eq('id', jobId)
    const provider = vi.spyOn(OpenRouterProvider.prototype, 'complete').mockImplementation(async request => {
      const selfCheck = request.prompt.includes('Perform one targeted self-check')
      if (selfCheck && mode === 'interrupted' && request.model === 'b/b') throw new Error('Fixture self-check outage')
      const pairs = JSON.parse(request.prompt.split('\nPairs: ')[1].split('\nReturn ONLY ')[0]) as Array<{ id: string; a: string; b: string }>
      return { model: request.model!, provider: 'custom', usage: { inputTokens: 10, outputTokens: 10 }, content: JSON.stringify({ pairs: pairs.map((pair, index) => {
        const redundant = request.model === 'b/b' && index === 0 && (!selfCheck || mode !== 'corrected')
        return { id: pair.id, behaviorA: pair.a, behaviorB: pair.b, relation: redundant ? 'mirror' : 'different_behaviors', conditionsEquivalent: true, redundant, reason: redundant ? 'The specific actions remain equivalent.' : 'The specific actions add different coverage.' }
      }) }) }
    })
    try {
      const result = await advanceLikert(db, buildId)
      expect(result.phase).toBe(mode === 'corrected' ? 'form_review' : 'select')
      expect(provider).toHaveBeenCalledTimes(4)
      const checkpoint = (await listStageRuns(db, buildId)).find(run => run.id === jobId)!.outputSnapshot as unknown as LikertState
      const checks = Object.values(checkpoint.pairChecks!)
      expect(checks).toHaveLength(6)
      expect(checks.every(check => check.reviewVersion === PAIR_REVIEW_VERSION)).toBe(true)
      expect(checks.filter(check => check.disagreedInitially)).toHaveLength(1)
      if (mode === 'corrected') {
        // The call cap must not discard a form whose evidence is already complete.
        await db.from('instrument_stage_runs').update({ output_snapshot: { ...checkpoint, calls: 600 } }).eq('id', jobId)
        expect((await advanceLikert(db, buildId)).ready).toBe(true)
        expect(provider).toHaveBeenCalledTimes(4)
        const complete = (await listStageRuns(db, buildId)).find(run => run.id === jobId)!.outputSnapshot as unknown as LikertState
        delete Object.values(complete.pairChecks!)[0].reviewVersion
        await db.from('instrument_stage_runs').update({ output_snapshot: complete }).eq('id', jobId)
        expect((await getLikertStatus(db, buildId))?.ready).toBe(false)
      } else expect(checks.some(check => check.redundant)).toBe(true)
    } finally { provider.mockRestore() }
  })
  it('does not expose service-only checkpoint RPCs to anonymous callers', async () => {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
    const { error } = await anon.rpc('instrument_likert_spec_snapshot', { p_build_id: buildId })
    expect(error).toBeTruthy()
  })
})
