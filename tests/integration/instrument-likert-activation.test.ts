import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { createBuild, createBlueprint, replaceBlueprintCells, createCandidateItem, updateCandidateItem, updateBlueprint, updateBuild, recordStageRun, claimStageRun, listCandidateItems } from '@/lib/dal/instrument'
import { activatePublishedLikertItems, listLikertFormats, likertSpecSnapshot } from '@/lib/dal/instrument-likert'
import { activateLikertPublication } from '@/lib/instrument/likert/pipeline'
import { LIKERT_STAGE, LIKERT_VERSION, likertOptionsSchema } from '@/lib/instrument/likert/contracts'

const local = /^http:\/\/(127\.0\.0\.1|localhost):/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
const canRun = local && !!process.env.SUPABASE_SERVICE_ROLE_KEY
const db = canRun ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } }) : null!
const fixtures: Array<{ buildId: string; constructId: string; libraryIds: string[] }> = []
let input: Parameters<typeof activatePublishedLikertItems>[1]
let libraryIds: string[]

describe.skipIf(!canRun)('autonomous Likert library activation (local database)', () => {
  beforeEach(async () => {
    const format = (await listLikertFormats(db))[0]
    const options = likertOptionsSchema.parse({ itemsPerConstruct: 4, responseFormatId: format.id })
    const build = await createBuild(db, { name: `LIKERT ACTIVATION ${randomUUID()}`, measureType: 'trait', config: { likert: options } })
    const constructId = randomUUID()
    libraryIds = []
    fixtures.push({ buildId: build.id, constructId, libraryIds })
    const created = await db.from('constructs').insert({ id: constructId, slug: `likert-activation-${constructId}`, name: 'Activation fixture' })
    if (created.error) throw created.error
    const bp = await createBlueprint(db, { buildId: build.id, measureType: 'trait', draftConstructName: 'Dependability', draftConstructDefinition: 'Following through on agreed work commitments.' })
    await updateBlueprint(db, bp.id, { constructId })
    const cells = await replaceBlueprintCells(db, bp.id, [{ facetLabel: 'Follow-through', facetDefinition: 'Completing agreed actions.', intensity: 'mid', targetItemCount: 4, displayOrder: 0 }])
    for (let index=0; index<4; index++) {
      const item = await createCandidateItem(db, { buildId: build.id, blueprintCellId: cells[0].id, stem: `Local transaction fixture for agreed action ${index}.`, reverseScored: false })
      const id = randomUUID(); libraryIds.push(id)
      const inserted = await db.from('items').insert({ id, construct_id: constructId, response_format_id: format.id, stem: item.stem, reverse_scored: false, status: 'draft', difficulty: 'medium' })
      if (inserted.error) throw inserted.error
      await updateCandidateItem(db, item.id, { status: 'accepted', publishedItemId: id })
    }
    const items = await listCandidateItems(db, build.id)
    // The RPC checks transactional storage invariants. The server's separate
    // quality gate must reject these deliberately unreviewed fixture items.
    const job = await recordStageRun(db, { buildId: build.id, stageKey: LIKERT_STAGE, status: 'success', outputSnapshot: { version: LIKERT_VERSION, revision: 1, phase: 'complete', options, models: { writer: 'a/a', blueprint: 'b/b', reviewers: ['a/a','b/b','c/c'] }, round: 0, calls: 0, failures: 0, selectedIds: items.map(item => item.id), blockers: [], generationCounts: {} } })
    const step = await claimStageRun(db, { buildId: build.id, stageKey: 'publish_readiness', startedAt: new Date().toISOString() })
    input = { buildId: build.id, publishStepId: step.id, jobId: job.id, revision: 1, snapshot: await likertSpecSnapshot(db, build.id), items }
  })
  afterAll(async () => {
    for (const fixture of fixtures) {
      for (const result of [await db.from('instrument_builds').delete().eq('id', fixture.buildId), await db.from('items').delete().in('id', fixture.libraryIds), await db.from('constructs').delete().eq('id', fixture.constructId)]) if (result.error) throw result.error
    }
  })
  const statuses = async () => (await db.from('items').select('status').in('id', libraryIds)).data!.map(item => item.status)
  it('activates the complete matching set atomically and supports an unchanged retry', async () => {
    expect(await activatePublishedLikertItems(db, input)).toBe(4)
    expect(await statuses()).toEqual(['active','active','active','active'])
    expect(await activatePublishedLikertItems(db, input)).toBe(4)
    expect((await db.from('item_reviews').select('id').in('item_id', libraryIds)).data).toHaveLength(0)
  })
  it('refuses activation at the server quality gate when a complete flag has no review evidence', async () => {
    await expect(activateLikertPublication(db, input.buildId, input.publishStepId)).rejects.toThrow('must pass every Likert check')
    expect(await statuses()).toEqual(['draft','draft','draft','draft'])
  })
  it.each(['text', 'key', 'format', 'archived', 'candidate', 'specification', 'lease', 'incomplete_set'])('rolls back the whole activation for %s changes', async change => {
    const changeLibraryItem = async (values: Record<string, unknown>) => { const { error } = await db.from('items').update(values).eq('id', libraryIds[1]); if (error) throw error }
    if (change==='text') await changeLibraryItem({ stem: 'Changed after automatic review.' })
    if (change==='key') await changeLibraryItem({ reverse_scored: true })
    if (change==='format') {
      const { data: alternate, error } = await db.from('response_formats').select('id').neq('id', (input.snapshot.format as { id: string }).id).limit(1).single()
      if (error) throw error
      await changeLibraryItem({ response_format_id: alternate.id })
    }
    if (change==='archived') await changeLibraryItem({ status: 'archived' })
    if (change==='candidate') await updateCandidateItem(db, input.items[1].id, { stem: 'Changed candidate after the check.' })
    if (change==='specification') await updateBuild(db, input.buildId, { brief: 'A changed specification.' })
    if (change==='lease') await db.from('instrument_stage_runs').update({ started_at: new Date(Date.now()-181_000).toISOString() }).eq('id', input.publishStepId)
    if (change==='incomplete_set') input.items.pop()
    await expect(activatePublishedLikertItems(db, input)).rejects.toThrow()
    expect((await statuses()).some(status => status==='active')).toBe(false)
  })
  it('does not expose activation to anonymous callers', async () => {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
    const { error } = await anon.rpc('activate_autonomous_likert_items', { p_build_id: input.buildId, p_publish_step_id: input.publishStepId, p_job_id: input.jobId, p_revision: 1, p_expected_spec: input.snapshot, p_expected_items: input.items })
    expect(error).toBeTruthy()
  })
})
