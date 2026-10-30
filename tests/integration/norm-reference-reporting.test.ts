import { randomUUID, createHash } from 'node:crypto'
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { canRun, createAdminClient, SUPABASE_URL, SUPABASE_ANON_KEY } from './_helpers/rls-fixture'
import { IPIP_DATABASE } from '@/lib/instrument/ipip-neo-120/database-form'
import { IPIP_ITEMS, IPIP_FORM_VERSION, IPIP_ITEMSET_SHA256, IPIP_SCORING_VERSION, IPIP_ID } from '@/lib/instrument/ipip-neo-120/definition'
import { getOrCreateSectionForms } from '@/lib/dal/session-forms'
import { processSnapshot } from '@/lib/reports/runner'
import { scoreIpipNeo120Session } from '@/lib/dal/ipip-neo-120'

// Execute the real database and report code outside the Next server cache.
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn, revalidatePath: vi.fn() }))

// Active references in this file are separately named SYNTHETIC fixtures. The
// 41 supplied source versions remain draft. Local/disposable Supabase only.
describe.skipIf(!canRun)('versioned reference reporting infrastructure', () => {
  const db = canRun ? createAdminClient() : null!
  const prefix = `reference-fixture-${randomUUID().slice(0, 8)}`
  const ids: Record<string, string> = {}
  let originalNative: unknown
  let firstReport = ''
  let secondReport = ''
  let secondSnapshot: Record<string, unknown>
  const scales = ['N','E','O','A','C'].flatMap(d => [d, ...[1,2,3,4,5,6].map(n => d + n)])
  const check = <T extends { error: unknown }>(result: T): T => { expect(result.error).toBeNull(); return result }
  async function insert(table: string, row: Record<string, unknown>) {
    const result = check(await db.from(table).insert(row).select('id').single())
    return String(result.data!.id)
  }
  async function reference(name: string, skew = false, status = 'active', scope: string | null = ids.client, itemset = IPIP_ITEMSET_SHA256) {
    const masses = Object.fromEntries(scales.map(s => {
      const size = s.length === 1 ? 97 : 17
      const values = Array.from({ length: size }, () => skew ? 0 : 1 / size)
      if (skew) { values[0] = 0.1; values[(size - 1) / 2] = 0.6; values[size - 1] = 0.3 }
      return [s, values]
    }))
    const artifact = JSON.stringify({ id: `${prefix}-${name}`, label: `SYNTHETIC ${name}`, rawN: 1700, kishEffectiveN: 1700, ageBoundsInclusive: [18,64], countryLabels: null, weighting: 'pooled', nativeScoreMass: masses })
    const id = await insert('norm_reference_versions', {
      group_key: `${prefix}:${name}`, name: `SYNTHETIC reference ${name}`, version: 'synthetic-test-v1',
      instrument_id: IPIP_ID, form_version: IPIP_FORM_VERSION, scoring_version: IPIP_SCORING_VERSION, itemset_sha256: itemset,
      method_version: 'weighted-empirical-midrank-v1', family: 'general-adult', scope_client_id: scope,
      artifact_text: artifact, artifact_sha256: createHash('sha256').update(artifact).digest('hex'), provenance: { collectionPeriod: 'Synthetic fixtures', population: 'Synthetic software acceptance only' }, status,
      review_evidence: status === 'active' ? { datasetReuse: 'approved', formEquivalence: 'approved', methodology: 'approved', stability: 'approved', intendedUse: 'approved', evidence: 'SYNTHETIC software test fixture; no real norm activation or review', reviewedBy: 'synthetic-fixture', reviewedAt: new Date().toISOString() } : {},
    })
    check(await db.from('assessment_norm_references').insert({ assessment_id: IPIP_DATABASE.assessmentId, reference_version_id: id }))
    return id
  }
  function enqueue(referenceId: string | null, requestId = randomUUID(), automatic = false, parent: string | null = null) {
    return db.rpc('enqueue_reference_report', { p_session_id: ids.session, p_template_id: ids.template, p_reference_id: referenceId, p_request_id: requestId, p_automatic: automatic, p_parent_snapshot_id: parent })
  }
  beforeAll(async () => {
    ids.client = await insert('clients', { name: prefix, slug: prefix })
    ids.otherClient = await insert('clients', { name: `${prefix}-other`, slug: `${prefix}-other` })
    ids.campaign = await insert('campaigns', { title: prefix, slug: prefix, client_id: ids.client, status: 'draft', is_internal: true })
    ids.uniform = await reference('uniform')
    ids.skew = await reference('skew', true)
    ids.draft = await reference('unreviewed', false, 'draft')
    ids.otherScope = await reference('other-client', false, 'active', ids.otherClient)
    ids.badForm = await reference('wrong-form', false, 'active', null, '0'.repeat(64))
    ids.ca = await insert('campaign_assessments', { campaign_id: ids.campaign, assessment_id: IPIP_DATABASE.assessmentId, reference_version_id: ids.uniform })
    ids.template = await insert('report_templates', { name: prefix, custom_report_slug: 'ipip-reference-comparison', is_active: true, auto_release: true })
    check(await db.from('campaign_report_templates').insert({ campaign_id: ids.campaign, template_id: ids.template }))
    ids.standard = await insert('report_templates', { name: `${prefix}-standard`, custom_report_slug: 'trajectas-personality-standard-v1', is_active: true, auto_release: false, presentation_config: { version: 1, coverHeadline: 'Frozen original headline', scales: {} } })
    check(await db.from('campaign_report_templates').insert({ campaign_id: ids.campaign, template_id: ids.standard }))
    ids.participant = await insert('campaign_participants', { campaign_id: ids.campaign, first_name: 'Synthetic', last_name: 'Reference', email: `${prefix}@test.local` })
    ids.session = await insert('participant_sessions', { campaign_id: ids.campaign, campaign_participant_id: ids.participant, client_id: ids.client, assessment_id: IPIP_DATABASE.assessmentId, status: 'completed', is_internal: true })
    const forms = await getOrCreateSectionForms(db, { sessionId: ids.session, assessmentId: IPIP_DATABASE.assessmentId, campaignId: ids.campaign })
    expect('error' in forms).toBe(false)
    check(await db.from('participant_responses').insert(IPIP_ITEMS.map(item => ({ session_id: ids.session, section_id: IPIP_DATABASE.sectionId, item_id: IPIP_DATABASE.items[item.itemId as keyof typeof IPIP_DATABASE.items], response_value: 3 }))))
    expect(await scoreIpipNeo120Session(db, ids.session)).toEqual({ success: true, scoreCount: 30 })
    originalNative = check(await db.from('participant_instrument_results').select('result').eq('session_id', ids.session).single()).data!.result
  }, 60_000)
  afterAll(async () => {
    if (ids.campaign) check(await db.from('campaigns').delete().eq('id', ids.campaign))
    if (ids.client) check(await db.from('clients').delete().eq('id', ids.client))
    if (ids.otherClient) check(await db.from('clients').delete().eq('id', ids.otherClient))
    // A global incompatible synthetic version has no participant information;
    // immutable reference metadata survives until this disposable stack is removed.
    if (ids.standard) check(await db.from('report_templates').delete().eq('id', ids.standard))
    if (ids.template) check(await db.from('report_templates').delete().eq('id', ids.template))
  }, 60_000)
  it('keeps draft references private and unavailable to anonymous consumers', async () => {
    const result = check(await db.from('norm_reference_versions').select('status,review_evidence').eq('id', ids.draft).single())
    expect(result.data).toEqual({ status: 'draft', review_evidence: {} })
    const anon = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
    expect((await anon.from('norm_reference_versions').select('id')).error?.code).toBe('42501')
    expect((await anon.rpc('enqueue_reference_report', { p_session_id: ids.session, p_template_id: ids.template, p_reference_id: ids.uniform, p_request_id: randomUUID() })).error).not.toBeNull()
  })
  it('loads actual assessment titles for catalog filters through the assignment relation', async () => {
    const result = check(await db.from('assessment_norm_references')
      .select('reference_version_id,is_default,assessments!inner(id,title)')
      .in('reference_version_id', [ids.uniform, ids.skew]).is('assessments.deleted_at', null))
    expect(result.data).toHaveLength(2)
    for (const row of result.data!) {
      const assessment = Array.isArray(row.assessments) ? row.assessments[0] : row.assessments
      expect(assessment).toMatchObject({ id: IPIP_DATABASE.assessmentId, title: 'Trajectas Personality Profile' })
    }
  })
  it('cannot activate an unreviewed version or edit a source distribution in place', async () => {
    expect((await db.from('norm_reference_versions').update({ status: 'active' }).eq('id', ids.draft)).error?.code).toBe('23514')
    expect((await db.from('norm_reference_versions').update({ name: 'Changed meaning' }).eq('id', ids.uniform)).error).not.toBeNull()
    expect((await db.from('norm_reference_versions').update({ artifact_text: '{}' }).eq('id', ids.uniform)).error).not.toBeNull()
  })
  it('creates an idempotent draft refresh with no inherited approval or changed campaign defaults', async () => {
    const prior = check(await db.from('norm_reference_versions').select('*').eq('id', ids.uniform).single()).data!
    const id = randomUUID(), provenance = { ...prior.provenance, previousVersionId: ids.uniform, sourceUrl: 'https://example.test/source', attribution: 'Synthetic software test data', refreshNotes: 'Synthetic aggregate refresh for database acceptance.', preparedBy: 'synthetic-reviewer', preparedAt: new Date().toISOString() }
    const request = { p_prior_id: ids.uniform, p_id: id, p_version: 'synthetic-test-v2', p_artifact: prior.artifact_text, p_hash: prior.artifact_sha256, p_provenance: provenance }
    expect(check(await db.rpc('create_norm_reference_version', request)).data).toBe(id)
    expect(check(await db.rpc('create_norm_reference_version', request)).data).toBe(id)
    expect((await db.rpc('create_norm_reference_version', { ...request, p_version: 'different' })).error).not.toBeNull()
    const refreshed = check(await db.from('norm_reference_versions').select('status,review_evidence').eq('id', id).single()).data!
    expect(refreshed).toEqual({ status: 'draft', review_evidence: {} })
    expect(check(await db.from('assessment_norm_references').select('is_default').eq('reference_version_id', id).single()).data?.is_default).toBe(false)
    expect(check(await db.from('campaign_assessments').select('reference_version_id').eq('id', ids.ca).single()).data?.reference_version_id).toBe(ids.uniform)
    expect((await enqueue(id)).error).not.toBeNull()
    expect(check(await db.from('norm_reference_versions').select('artifact_sha256,status').eq('id', ids.uniform).single()).data).toMatchObject({ artifact_sha256: prior.artifact_sha256, status: 'active' })
  })
  it('produces separate frozen 35-scale interpretations from one saved result', async () => {
    firstReport = String(check(await enqueue(ids.uniform)).data)
    secondReport = String(check(await enqueue(ids.skew, randomUUID(), false, firstReport)).data)
    expect(firstReport).not.toBe(secondReport)
    const rows = check(await db.from('report_snapshots').select('*').in('id', [firstReport, secondReport])).data!
    const a = rows.find(r => r.id === firstReport)!
    const b = rows.find(r => r.id === secondReport)!
    secondSnapshot = b
    expect(a.edition_number).toBe(2)
    expect(b.edition_number).toBe(3)
    expect(a.status).toBe('pending')
    expect(a.participant_selected).toBe(false)
    expect(b.generation_manifest.nativeResult).toEqual(originalNative)
    expect(b.generation_manifest.template.name).toBe(prefix)
    expect(Object.keys(b.reference_interpretation.scores)).toHaveLength(35)
    expect(a.reference_interpretation.scores.N4.displayPercentile).toBeCloseTo(50, 10)
    expect(b.reference_interpretation.scores.N4.nativePercentile).toBeCloseTo(40, 10)
    expect(b.reference_interpretation.scores.N4.displayPercentile).toBeCloseTo(60, 10)
    expect(b.reference_interpretation.scores.N6.displayPercentile).toBeCloseTo(60, 10)
    expect(b.reference_interpretation.scores.N.displayPercentile).toBeCloseTo(40, 10)
  })
  it('generates a manual edition for review even when its frozen template auto-releases automatic reports', async () => {
    await processSnapshot(firstReport)
    const row = check(await db.from('report_snapshots').select('status,released_at,rendered_data').eq('id', firstReport).single()).data!
    expect(row.status).toBe('ready')
    expect(row.released_at).toBeNull()
    expect(row.rendered_data[0].data.payload.schemaVersion).toBe('personality-reference-report-v1')
    expect(row.rendered_data[0].data.payload.scales).toHaveLength(35)
  })
  it('generates the standard report with a pinned norm and preserves its presentation across later template edits', async () => {
    const request = randomUUID()
    const id = String(check(await db.rpc('enqueue_reference_report', { p_session_id: ids.session, p_template_id: ids.standard, p_reference_id: ids.uniform, p_request_id: request, p_automatic: true })).data)
    check(await db.from('report_templates').update({ presentation_config: { version: 1, coverHeadline: 'Edited after queue', scales: {} } }).eq('id', ids.standard))
    await processSnapshot(id)
    const first = check(await db.from('report_snapshots').select('*').eq('id', id).single()).data!
    expect(first.status).toBe('ready')
    const payload = first.rendered_data[0].data.payload
    expect(payload.coverHeadline).toBe('Frozen original headline')
    expect(payload.reference.id).toBe(ids.uniform)
    expect(payload.dimensions.flatMap((d: { facets: unknown[] }) => d.facets)).toHaveLength(30)
    const alternate = String(check(await db.rpc('enqueue_reference_report', { p_session_id: ids.session, p_template_id: ids.standard, p_reference_id: ids.skew, p_request_id: randomUUID(), p_parent_snapshot_id: id })).data)
    await processSnapshot(alternate)
    const second = check(await db.from('report_snapshots').select('*').eq('id', alternate).single()).data!
    expect(second.status).toBe('ready')
    expect(second.edition_number).toBe(2)
    expect(second.rendered_data[0].data.payload.coverHeadline).toBe('Edited after queue')
    expect(second.rendered_data[0].data.payload.reference.id).toBe(ids.skew)
    expect(second.rendered_data[0].data.payload.dimensions.find((d: { code: string }) => d.code === 'N').percentile).toBe(40)
    expect(check(await db.from('report_snapshots').select('rendered_data').eq('id', id).single()).data!.rendered_data).toEqual(first.rendered_data)
    expect(check(await db.from('participant_instrument_results').select('result').eq('session_id', ids.session).single()).data!.result).toEqual(originalNative)
    expect((await db.rpc('enqueue_reference_report', { p_session_id: ids.session, p_template_id: ids.standard, p_reference_id: null, p_request_id: randomUUID() })).error?.message).toContain('requires a norm')
  })
  it('converges concurrent retries of the same request and refuses a reused key with different inputs', async () => {
    const key = randomUUID()
    const attempts = await Promise.all(Array.from({ length: 6 }, () => enqueue(ids.uniform, key)))
    expect(attempts.every(r => !r.error)).toBe(true)
    expect(new Set(attempts.map(r => r.data)).size).toBe(1)
    expect(check(await db.from('report_snapshots').select('id').eq('generation_request_id', key)).data).toHaveLength(1)
    expect((await enqueue(ids.skew, key)).error).not.toBeNull()
  })
  it('refuses incompatible, private-outside-client and draft references', async () => {
    for (const id of [ids.draft, ids.badForm, ids.otherScope]) expect((await enqueue(id)).error).not.toBeNull()
    expect((await db.from('campaign_assessments').update({ reference_version_id: ids.skew }).eq('id', ids.ca)).error?.message).toContain('frozen')
    const other = await insert('assessments', { title: `${prefix}-other-form`, slug: `${prefix}-other-form` })
    expect((await db.rpc('set_assessment_reference_default', { p_assessment_id: other, p_reference_id: ids.badForm })).error).not.toBeNull()
    check(await db.from('assessments').delete().eq('id', other))
  })
  it('keeps automatic edition 1 and participant selection separate from manual comparisons', async () => {
    const automatic = String(check(await enqueue(ids.uniform, randomUUID(), true)).data)
    const record = check(await db.from('report_snapshots').select('edition_number,participant_selected').eq('id', automatic).single()).data!
    expect(record).toEqual({ edition_number: 1, participant_selected: true })
    for (const id of [automatic]) check(await db.from('report_snapshots').update({ status: 'ready', rendered_data: [{ synthetic: true }], generated_at: new Date().toISOString() }).eq('id', id))
    check(await db.from('report_snapshots').update({ status: 'released', released_at: new Date().toISOString() }).in('id', [automatic, firstReport]))
    check(await db.rpc('select_participant_report_edition', { p_snapshot_id: firstReport }))
    expect(check(await db.from('report_snapshots').select('id').eq('participant_session_id', ids.session).eq('template_id', ids.template).eq('participant_selected', true)).data).toEqual([{ id: firstReport }])
    expect(check(await db.from('report_snapshots').select('id').in('id', [automatic, firstReport])).data).toHaveLength(2)
    expect((await db.from('report_snapshots').update({ status: 'pending', rendered_data: null }).eq('id', firstReport)).error).not.toBeNull()
    expect((await db.from('report_snapshots').update({ reference_version_id: ids.skew }).eq('id', firstReport)).error).not.toBeNull()
  })
  it('withdraws future use without re-norming an earlier saved snapshot or native scores', async () => {
    check(await db.from('norm_reference_versions').update({ status: 'withdrawn' }).eq('id', ids.skew))
    expect((await enqueue(ids.skew)).error).not.toBeNull()
    expect(check(await db.from('report_snapshots').select('reference_interpretation').eq('id', secondReport).single()).data!.reference_interpretation).toEqual(secondSnapshot.reference_interpretation)
    expect(check(await db.from('participant_instrument_results').select('result').eq('session_id', ids.session).single()).data!.result).toEqual(originalNative)
    expect(check(await db.from('participant_scores').select('percentile,norm_group_id,norm_version').eq('session_id', ids.session)).data!.every(r => r.percentile === null && r.norm_group_id === null && r.norm_version === null)).toBe(true)
    expect((await db.from('norm_reference_versions').update({ status: 'active' }).eq('id', ids.skew)).error).not.toBeNull()
  })
  it('continues to refuse individual report generation on aggregate-only campaigns', async () => {
    // Existing campaigns cannot change confidentiality after enrolment. Test
    // the new writer against a separate aggregate-only campaign from the start.
    const campaign = await insert('campaigns', { title: `${prefix}-aggregate`, slug: `${prefix}-aggregate`, client_id: ids.client, confidentiality_mode: 'aggregate_only', is_internal: true })
    const session = await insert('participant_sessions', { campaign_id: campaign, client_id: ids.client, assessment_id: IPIP_DATABASE.assessmentId, status: 'completed', is_internal: true })
    const result = await db.rpc('enqueue_reference_report', { p_session_id: session, p_template_id: ids.template, p_reference_id: ids.uniform, p_request_id: randomUUID() })
    expect(result.error?.message).toContain('individual reports')
    check(await db.from('campaigns').delete().eq('id', campaign))
  })
})
