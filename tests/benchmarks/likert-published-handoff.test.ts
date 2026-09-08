/** Opt-in local publication/activation and assessment-builder handoff check. */
import { expect, it, vi } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'node:fs'

const runtime = vi.hoisted(() => ({ db: null as unknown as SupabaseClient }))
vi.mock('@/lib/auth/authorization', () => ({ resolveAuthorizedScope: async () => ({ actor: null }), canManageAssessmentLibrary: () => true, requireAdminScope: async () => ({ actor: null }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => runtime.db }))
vi.mock('@/lib/auth/support-sessions', () => ({ logAuditEvent: async () => {} }))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

import { getConstructsForBuilder, getFormatBreakdown } from '@/app/actions/assessments'
import { loadLikertContext, assertLikertPublishable } from '@/lib/instrument/likert/pipeline'
import { publishBuild } from '@/app/actions/instrument'

const enabled = process.env.LIKERT_LIVE === '1' && !!process.env.LIKERT_RESUME_BUILD
it.runIf(enabled)('makes the exact published Likert form available to the construct-based assessment builder', async () => {
  if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')) throw new Error('LOCAL DATABASE REQUIRED')
  runtime.db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  const buildId = process.env.LIKERT_RESUME_BUILD!
  const { build, spec, items } = await loadLikertContext(runtime.db, buildId)
  expect(build.status).toBe('published')
  await assertLikertPublishable(runtime.db, buildId, spec.format.id)
  // A retry also activates unchanged drafts published before the activation fix.
  const publication = await publishBuild(buildId, { responseFormatId: spec.format.id })
  expect(publication.warnings).toEqual([])
  const selected = items.filter(item => item.status === 'accepted')
  const { data: libraryItems, error } = await runtime.db.from('items').select('id,construct_id,stem,reverse_scored,response_format_id,status').in('id', selected.map(item => item.publishedItemId!))
  expect(error).toBeNull()
  expect(libraryItems).toHaveLength(spec.itemsPerConstruct * spec.constructs.length)
  for (const item of selected) expect(libraryItems!.find(row => row.id === item.publishedItemId)).toMatchObject({ stem: item.stem, reverse_scored: item.reverseScored, response_format_id: spec.format.id, status: 'active' })
  const ids = [...new Set(libraryItems!.map(item => item.construct_id))]
  const builder = (await getConstructsForBuilder()).filter(construct => ids.includes(construct.id))
  expect(builder).toHaveLength(spec.constructs.length)
  for (const construct of builder) expect(construct.itemCount).toBe(spec.itemsPerConstruct)
  const formats = await getFormatBreakdown({ constructIds: ids })
  expect(formats).toHaveLength(1)
  expect(formats[0]).toMatchObject({ responseFormatId: spec.format.id, formatType: 'likert', itemCount: selected.length })
  const dir = process.env.LIKERT_ARTIFACT_DIR ?? 'output/autonomous-likert'
  mkdirSync(dir, { recursive: true })
  writeFileSync(`${dir}/published-handoff.json`, JSON.stringify({ at: new Date().toISOString(), buildId, publication, builder, formats, libraryItems }, null, 2))
})
