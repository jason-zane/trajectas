import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { canRun, createAdminClient } from './_helpers/rls-fixture'
import { getOrCreateSectionForms } from '@/lib/dal/session-forms'

/** These fixtures use the real assembler and the service-only runtime RPCs. */
describe.skipIf(!canRun)('assessment delivery integrity', () => {
  const db = createAdminClient()
  const client = randomUUID(), assessment = randomUUID(), campaign = randomUUID()
  const construct = randomUUID(), factor = randomUUID()
  const format = randomUUID(), section = randomUUID(), item = randomUUID(), excluded = randomUUID()
  const participant = randomUUID(), session = randomUUID(), token = randomUUID()
  const reportCampaign = randomUUID(), reportParticipant = randomUUID(), reportSession = randomUUID(), reportToken = randomUUID()
  let successor: string | null = null
  const reportTemplates: string[] = []
  async function insert(table: string, rows: Record<string, unknown> | Record<string, unknown>[]) {
    const { error } = await db.from(table).insert(rows)
    if (error) throw new Error(`${table}: ${error.message}`)
  }
  async function save(value: number, revision = 0, itemId = item) {
    const { data, error } = await db.rpc('save_responses_batch_for_session', {
      p_access_token: token, p_session_id: session,
      p_saves: [{ itemId, responseValue: value, revision, idempotencyKey: `${revision}-${value}` }],
    })
    expect(error).toBeNull()
    return data
  }
  async function value() {
    const { data, error } = await db.from('participant_responses').select('response_value,client_revision')
      .eq('session_id', session).eq('item_id', item).maybeSingle()
    expect(error).toBeNull()
    return data
  }
  beforeAll(async () => {
    await insert('clients', { id: client, name: 'Delivery test', slug: client })
    await insert('response_formats', { id: format, name: `Delivery Likert ${format}`, type: 'likert', config: { points: 5 } })
    await insert('assessments', { id: assessment, title: 'Delivery test', slug: assessment, client_id: client })
    await insert('constructs', { id: construct, name: construct, slug: construct })
    await insert('factors', { id: factor, name: factor, slug: factor })
    await insert('factor_constructs', { factor_id: factor, construct_id: construct, weight: 1 })
    await insert('assessment_factors', { assessment_id: assessment, factor_id: factor })
    await insert('assessment_sections', { id: section, assessment_id: assessment, response_format_id: format, title: 'Timed', time_limit_seconds: 300 })
    await insert('items', [{ id: item, response_format_id: format, stem: 'Original wording', purpose: 'construct', construct_id: construct },
      { id: excluded, response_format_id: format, stem: 'Outside form', purpose: 'impression_management' }])
    await insert('item_options', [1, 3, 5].map(v => ({ item_id: item, label: String(v), value: v, display_order: v })))
    await insert('assessment_section_items', { section_id: section, item_id: item })
    await insert('campaigns', { id: campaign, title: 'Delivery campaign', slug: campaign, client_id: client, status: 'active', confidentiality_mode: 'aggregate_only' })
    await insert('campaign_assessments', { campaign_id: campaign, assessment_id: assessment })
    await insert('campaign_participants', { id: participant, campaign_id: campaign, email: `${participant}@test.local`, first_name: 'Test', access_token: token, status: 'in_progress' })
    await insert('participant_sessions', { id: session, campaign_participant_id: participant, assessment_id: assessment, campaign_id: campaign, client_id: client, status: 'in_progress' })
    const forms = await getOrCreateSectionForms(db, { sessionId: session, assessmentId: assessment, campaignId: campaign })
    expect('error' in forms).toBe(false)
    // Confidentiality is fixed before enrollment. Report scenarios use a
    // distinct standard campaign instead of mutating the aggregate promise.
    await insert('campaigns', { id: reportCampaign, title: 'Report delivery', slug: reportCampaign,
      client_id: client, status: 'active', confidentiality_mode: 'standard' })
    await insert('campaign_assessments', { campaign_id: reportCampaign, assessment_id: assessment })
    await insert('campaign_participants', { id: reportParticipant, campaign_id: reportCampaign,
      email: `${reportParticipant}@test.local`, first_name: 'Report', access_token: reportToken, status: 'completed' })
    await insert('participant_sessions', { id: reportSession, campaign_participant_id: reportParticipant,
      assessment_id: assessment, campaign_id: reportCampaign, client_id: client, status: 'completed', processing_status: 'ready' })
    const reportForms = await getOrCreateSectionForms(db, {
      sessionId: reportSession, assessmentId: assessment, campaignId: reportCampaign,
    })
    expect('error' in reportForms).toBe(false)
    await insert('participant_responses', { session_id: reportSession, item_id: item, section_id: section, response_value: 5 })

  })
  afterAll(async () => {
    await db.from('participant_sessions').delete().in('id', [session, reportSession])
    if (reportTemplates.length) await db.from('report_templates').delete().in('id', reportTemplates)
    await db.from('campaign_participants').delete().in('id', [participant, reportParticipant])
    await db.from('campaigns').delete().in('id', [campaign, reportCampaign])
    await db.from('assessments').delete().eq('id', assessment)
    if (successor) await db.from('items').delete().eq('id', successor)
    await db.from('items').delete().in('id', [item, excluded])
    await db.from('response_formats').delete().eq('id', format)
    await db.from('factors').delete().eq('id', factor)
    await db.from('constructs').delete().eq('id', construct)
    await db.from('clients').delete().eq('id', client)
  })
  it('requires server timing before a timed save and only accepts frozen form entries', async () => {
    expect((await save(3)).acked).toEqual([])
    expect(await value()).toBeNull()
    const { getSessionState } = await import('@/app/actions/assess')
    const unopened = await getSessionState(token, session)
    expect(unopened.data?.sections[0]?.items[0]?.stem).toBe('')
    expect(unopened.data?.sections[0]?.items[0]?.options).toEqual([])
    expect((await save(3, 0, excluded)).terminal).toEqual([excluded])
    const opened = await db.rpc('start_section_for_session', { p_access_token: token, p_session_id: session, p_section_id: section })
    expect(opened.error).toBeNull()
    expect(opened.data.deadlineAt).toBeTruthy()
    const visible = await getSessionState(token, session, 0)
    expect(visible.data?.sections[0]?.items[0]?.stem).toBe('Original wording')
    expect((await save(3)).acked).toEqual([item])
  })
  it('rejects fractional and unoffered discrete values', async () => {
    for (const invalid of [2.5, 2, -1, 6]) expect((await save(invalid)).terminal).toEqual([item])
    expect(Number((await value())?.response_value)).toBe(3)
  })
  it('serializes concurrent revisions and ignores stale/legacy replays', async () => {
    await Promise.all([save(1, 1), save(5, 3), save(3, 2)])
    await save(1, 1)
    await save(1)
    expect(Number((await value())?.response_value)).toBe(5)
    expect(Number((await value())?.client_revision)).toBe(3)
  })
  it('rejects withdrawn participants, paused/deleted/outside-window campaigns, and completed sessions', async () => {
    await db.from('campaign_participants').update({ status: 'withdrawn' }).eq('id', participant)
    expect(await save(1, 4)).toBe(-1)
    await db.from('campaign_participants').update({ status: 'in_progress' }).eq('id', participant)
    for (const patch of [{ status: 'paused' }, { status: 'active', closes_at: new Date(0).toISOString() },
      { closes_at: null, opens_at: '2999-01-01T00:00:00Z' }, { opens_at: null, deleted_at: new Date().toISOString() }]) {
      await db.from('campaigns').update(patch).eq('id', campaign)
      expect(await save(1, 4)).toBe(-1)
    }
    await db.from('campaigns').update({ deleted_at: null }).eq('id', campaign)
    await db.from('participant_sessions').update({ status: 'completed' }).eq('id', session)
    expect(await save(1, 4)).toBe(-1)
    expect(Number((await value())?.response_value)).toBe(5)
  })
  it('keeps delivered content/answers immutable and atomically creates an editable successor', async () => {
    const direct = await db.from('items').update({ stem: 'Tampered' }).eq('id', item)
    expect(direct.error?.code).toBe('23514')
    const option = await db.from('item_options').update({ score_value: 99 }).eq('item_id', item)
    expect(option.error?.code).toBe('23514')
    const result = await db.rpc('revise_library_item', { p_item_id: item, p_patch: { stem: 'Revised wording' },
      p_options: [{ label: 'No', value: 1 }, { label: 'Yes', value: 5 }] })
    expect(result.error).toBeNull()
    successor = result.data
    expect(successor).not.toBe(item)
    const { data: old } = await db.from('items').select('stem,item_version').eq('id', item).single()
    const { data: next } = await db.from('items').select('stem,parent_item_id,item_version,status').eq('id', successor!).single()
    expect(old?.stem).toBe('Original wording')
    expect(next).toMatchObject({ stem: 'Revised wording', parent_item_id: item, status: 'draft' })
    expect(next!.item_version).toBeGreaterThan(old!.item_version)
    const { data: links } = await db.from('assessment_section_items').select('item_id').eq('section_id', section)
    expect(links).toEqual([{ item_id: item }])
  })
  it('preserves a usable completion token when the submit response is retried', async () => {
    const { submitSession, validateAccessToken, getSessionState } = await import('@/app/actions/assess')
    const result = await submitSession(token, session)
    expect(result).toMatchObject({ ok: true, outcome: 'completed_no_report' })
    expect(await submitSession(token, session)).toMatchObject({ ok: true, outcome: 'completed_no_report' })
    const { data } = await db.from('campaign_participants').select('access_token,status').eq('id', participant).single()
    expect(data).toEqual({ access_token: token, status: 'completed' })
    expect((await validateAccessToken(token)).error).toBeUndefined()
    expect((await getSessionState(token, session, 0)).data?.status).toBe('completed')
  })
  it('withholds unreleased content and explicit internal audiences at the participant action boundary', async () => {
    const { getParticipantReportSnapshot } = await import('@/app/actions/assess')
    const publicTemplate = randomUUID(), internalTemplate = randomUUID()
    reportTemplates.push(publicTemplate, internalTemplate)
    await insert('report_templates', [{ id: publicTemplate, name: publicTemplate }, { id: internalTemplate, name: internalTemplate }])
    const pendingReport = randomUUID(), internalReport = randomUUID()
    await insert('report_snapshots', [
      { id: pendingReport, participant_session_id: reportSession, campaign_id: reportCampaign, template_id: publicTemplate,
        status: 'ready', rendered_data: [{ type: 'custom_text', text: 'PRIVATE REPORT' }], pdf_url: 'private/unreleased.pdf' },
      { id: internalReport, participant_session_id: reportSession, campaign_id: reportCampaign, template_id: internalTemplate,
        status: 'released', audience_type: 'consultant', rendered_data: [{ type: 'custom_text', text: 'INTERNAL REPORT' }] },
    ])
    expect(await getParticipantReportSnapshot(reportToken, pendingReport)).toEqual({ id: pendingReport, status: 'ready', renderedData: [] })
    expect(await getParticipantReportSnapshot(reportToken, internalReport)).toBeNull()
    expect((await getParticipantReportSnapshot(reportToken))?.id).toBe(pendingReport)
    await db.from('report_snapshots').update({ status: 'released', pdf_url: null }).eq('id', pendingReport)
    expect((await getParticipantReportSnapshot(reportToken, pendingReport))?.renderedData).toEqual([{ type: 'custom_text', text: 'PRIVATE REPORT' }])
  })
  it('serializes processing retries and permits recovery after a worker lease expires', async () => {
    await db.from('participant_sessions').update({ processing_status: 'idle' }).eq('id', session)
    const claim = () => db.rpc('claim_session_processing', { p_session_id: session })
    const claims = await Promise.all([claim(), claim(), claim()])
    expect(claims.every(result => result.error === null)).toBe(true)
    expect(claims.filter(result => result.data === true)).toHaveLength(1)
    await db.from('participant_sessions').update({ processing_claimed_at: new Date(0).toISOString() }).eq('id', session)
    expect((await claim()).data).toBe(true)
    await db.from('participant_sessions').update({ processing_claimed_at: null, processing_status: 'ready' }).eq('id', session)
    expect((await claim()).data).toBe(false)
  })

  it('automatically recovers stale completed scoring before snapshots exist, without duplicating active work', async () => {
    const { recoverInterruptedSessionProcessing } = await import('@/lib/dal/session-processing-recovery')
    const scoring = await import('@/lib/scoring/dispatch')
    const scoreSpy = vi.spyOn(scoring, 'scoreSession')
    const staleTime = new Date(Date.now() - 11 * 60 * 1000).toISOString()
    const recoveryTemplate = randomUUID()
    reportTemplates.push(recoveryTemplate)
    await insert('report_templates', { id: recoveryTemplate, name: recoveryTemplate, is_active: true })
    await insert('campaign_report_templates', { campaign_id: reportCampaign, template_id: recoveryTemplate })
    await db.from('report_snapshots').delete().eq('participant_session_id', reportSession)
    await db.from('participant_sessions').update({ completed_at: staleTime, processing_status: 'scoring',
      processing_claimed_at: new Date().toISOString() }).eq('id', reportSession)

    // Keep the real PostgREST query/filters, scoped to this fixture so the test
    // never recovers another suite's deliberately interrupted session.
    const scopedClient = {
      from: () => ({ select: (columns: string) => db.from('participant_sessions').select(columns).eq('id', reportSession) }),
    } as unknown as ReturnType<typeof createAdminClient>
    const run = () => recoverInterruptedSessionProcessing({ client: scopedClient })
    expect(await run()).toEqual({ picked: 0, attempted: 0, failed: 0 })
    expect(scoreSpy).not.toHaveBeenCalled()

    await db.from('participant_sessions').update({ processing_claimed_at: staleTime }).eq('id', reportSession)
    const results = await Promise.all([run(), run()])
    expect(results.every(result => result.failed === 0)).toBe(true)
    expect(scoreSpy).toHaveBeenCalledTimes(1)
    const { data: state } = await db.from('participant_sessions').select('processing_status,processing_claimed_at')
      .eq('id', reportSession).single()
    expect(state).toEqual({ processing_status: 'reporting', processing_claimed_at: null })
    const { data: snapshots } = await db.from('report_snapshots').select('template_id,status').eq('participant_session_id', reportSession)
    expect(snapshots).toEqual([{ template_id: recoveryTemplate, status: 'pending' }])
    expect(await run()).toEqual({ picked: 0, attempted: 0, failed: 0 })
  })

})
