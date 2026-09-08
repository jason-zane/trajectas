/** Opt-in benchmark: real OpenRouter models and isolated local database fixtures. */
import { beforeAll, afterAll, expect, it, vi } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const runtime = vi.hoisted(() => ({ db: null as unknown as SupabaseClient, modelConfigs: [] as Array<{ purpose: string; model_id: string; config: Record<string, unknown> }> }))
vi.mock('@/lib/ai/model-config', () => ({ getModelForTask: async (purpose: string) => {
  const row = runtime.modelConfigs.find(row => row.purpose === purpose)
  if (!row) throw new Error(`Missing model configuration ${purpose}`)
  return { purpose, modelId: row.model_id, config: row.config }
} }))
vi.mock('@/lib/auth/authorization', () => ({ requireAdminScope: async () => ({ actor: null }), resolveAuthorizedScope: async () => ({ actor: null }), canManageAssessmentLibrary: () => true }))
vi.mock('@/lib/auth/support-sessions', () => ({ logAuditEvent: async () => {} }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => runtime.db }))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

import { createBuild, createBlueprint, listCandidateItems, listStageRuns } from '@/lib/dal/instrument'
import { startLikert, advanceLikert, loadLikertContext, assertLikertPublishable } from '@/lib/instrument/likert/pipeline'
import { publishBuild } from '@/app/actions/instrument'
import { getConstructsForBuilder, getFormatBreakdown } from '@/app/actions/assessments'

const enabled = process.env.LIKERT_LIVE === '1'
const itemCount = Number(process.env.LIKERT_ITEMS_PER_CONSTRUCT ?? 6)
const dir = process.env.LIKERT_ARTIFACT_DIR ?? 'output/autonomous-likert'
let buildId: string | undefined
const progress: unknown[] = []
beforeAll(() => {
  if (!enabled) return
  mkdirSync(dir, { recursive: true })
  if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')) throw new Error('LOCAL DATABASE REQUIRED')
  runtime.db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  const snapshot = JSON.parse(readFileSync(process.env.LIKERT_MODEL_SNAPSHOT ?? 'tests/benchmarks/likert-models.json', 'utf8'))
  runtime.modelConfigs = Array.isArray(snapshot) ? snapshot : snapshot.queries.models.rows
})
afterAll(async () => {
  if (!enabled || !buildId) return
  const [items, runs] = await Promise.all([listCandidateItems(runtime.db, buildId), listStageRuns(runtime.db, buildId)])
  writeFileSync(`${dir}/live-results.json`, JSON.stringify({ at: new Date().toISOString(), buildId, progress, items, runs }, null, 2))
})

it.runIf(enabled)('creates and reviews a complete two-construct Likert form, and publishes with verified keys', async () => {
  if (process.env.LIKERT_RESUME_BUILD) {
    buildId = process.env.LIKERT_RESUME_BUILD
    progress.push(...JSON.parse(readFileSync(`${dir}/live-progress.json`, 'utf8')))
  } else {
  const traitScenario = process.env.LIKERT_SCENARIO === 'traits'
  const measureType = traitScenario ? 'trait' : 'competency_behavioural'
  const build = await createBuild(runtime.db, { name: `LIKERT LIVE ${randomUUID()}`, measureType, brief: traitScenario ? 'A brief self-report of orderliness and sociability for development in the general adult workforce.' : 'A brief self-report of dependable follow-through and adjustment to changed work demands. Development use, general adult workforce.', audience: { level: 'entry', description: 'Adults in a broad range of individual-contributor roles; plain English.' }, useContext: 'development' })
  buildId = build.id
  writeFileSync(`${dir}/live-build.json`, JSON.stringify({ buildId }))
  const definitions = traitScenario ? [
    ['Orderliness', 'Keeping work materials and information arranged so they can be found and used. Includes consistent places, clear records and tidying after tasks. Excludes meeting deadlines, aesthetic taste, ownership of a private workspace and rigid adherence to routines.'],
    ['Sociability', 'Seeking and enjoying social interaction with other people at work. Includes initiating contact and enjoying informal conversation. Excludes public speaking skill, assertiveness, being liked by others and work performance.'],
  ] : [
    ['Dependability', 'Following through on work commitments and completing agreed tasks on time. Excludes changing work methods, sociability, long hours, health and family circumstances.'],
    ['Behavioural Adaptability', 'Changing work methods or priorities when task demands or constraints change. Excludes meeting unchanged commitments, learning from feedback, emotional recovery and novelty seeking.'],
  ]
  for (const [draftConstructName, draftConstructDefinition] of definitions) await createBlueprint(runtime.db, { buildId, measureType, draftConstructName, draftConstructDefinition })
  }
  let status = await startLikert(runtime.db, buildId!, { itemsPerConstruct: itemCount, readingLevel: 'entry', reverseProportion: 1 / 3, timeframe: 'Over the past three months' })
  if (status.phase === 'incomplete' && process.env.LIKERT_RESUME_BUILD) status = await advanceLikert(runtime.db, buildId!, true)
  let errors = 0
  for (let step = 0; step < 200 && !status.ready && status.phase !== 'incomplete'; step++) {
    try { status = await advanceLikert(runtime.db, buildId!); errors = 0 }
    catch (error) { progress.push({ step, error: String(error) }); console.log(`LIKERT step ${step} ERROR ${String(error)}`); if (++errors >= 3) throw error; continue }
    if (status.busy) await new Promise(resolve => setTimeout(resolve, 3000))
    progress.push({ step, ...status })
    writeFileSync(`${dir}/live-progress.json`, JSON.stringify(progress, null, 2))
    console.log(`LIKERT ${step} ${status.phase}: ${status.detail} (${status.passed}/${status.totalCandidates} passed)`)
  }
  expect(status.ready, status.blockers.join('\n')).toBe(true)
  const { spec, items } = await loadLikertContext(runtime.db, buildId!)
  const selected = items.filter(item => item.status === 'accepted')
  expect(selected).toHaveLength(itemCount * 2)
  expect(selected.filter(item => item.reverseScored)).toHaveLength(Math.round(itemCount / 3) * 2)
  await assertLikertPublishable(runtime.db, buildId!, spec.format.id)
  const published = await publishBuild(buildId!, { responseFormatId: spec.format.id })
  progress.push({ published })
  expect(published.itemsPublished).toBe(itemCount * 2)
  expect(published.warnings).toEqual([])
  const publishedContext = await loadLikertContext(runtime.db, buildId!)
  expect(publishedContext.build.status).toBe('published')
  const finalCandidates = publishedContext.items.filter(item => item.status === 'accepted')
  const { data: libraryItems, error } = await runtime.db.from('items').select('id,construct_id,stem,reverse_scored,response_format_id,status').in('id', finalCandidates.map(item => item.publishedItemId!))
  expect(error).toBeNull()
  expect(libraryItems).toHaveLength(itemCount * 2)
  for (const candidate of finalCandidates) expect(libraryItems!.find(item => item.id === candidate.publishedItemId)).toMatchObject({ stem: candidate.stem, reverse_scored: candidate.reverseScored, response_format_id: spec.format.id, status: 'active' })
  const constructIds = [...new Set(libraryItems!.map(item => item.construct_id))]
  const builder = (await getConstructsForBuilder()).filter(construct => constructIds.includes(construct.id))
  expect(builder).toHaveLength(2)
  expect(builder.every(construct => construct.itemCount === itemCount)).toBe(true)
  const formats = await getFormatBreakdown({ constructIds })
  expect(formats).toEqual([expect.objectContaining({ responseFormatId: spec.format.id, formatType: 'likert', itemCount: itemCount * 2 })])
  progress.push({ builder, formats })
}, 2_400_000)
