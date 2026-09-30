import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { canRun, createAdminClient, createTestUser } from './_helpers/rls-fixture'
import type { ResolvedActor } from '@/lib/auth/types'

const state = vi.hoisted(() => ({
  actor: null as ResolvedActor | null,
  admin: null as unknown as SupabaseClient,
  user: null as unknown as SupabaseClient,
  host: 'client.trajectas.com',
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.admin }))
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => state.user,
  createClient: async () => state.user,
}))
vi.mock('@/lib/auth/actor', () => ({
  resolveSessionActor: async () => state.actor,
  resolveSignedPreviewContext: async () => null,
}))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ host: state.host }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { AuthorizationError, requireReportSnapshotReadAccess } from '@/lib/auth/authorization'
import { getSessionDetail, getSessionSnapshots, getConstructScoresForFactor } from '@/app/actions/sessions'
import { getContentSources } from '@/app/actions/content-sources'
import { getItemSelectionRulesForEstimate } from '@/app/actions/item-selection-rules'

// Real local PostgREST/RLS plus the actual application authorization functions.
// The shared fixture refuses non-local hosts; no production users are created.
describe.skipIf(!canRun)('security review access-control regressions', () => {
  const suffix = randomUUID()
  const rows: Array<[string, string]> = []
  const users: string[] = []
  const ids: Record<string, string> = {}
  const actors: Record<string, ResolvedActor> = {}
  const clients: Record<string, SupabaseClient> = {}
  let anon: SupabaseClient

  async function insert(table: string, values: Record<string, unknown>) {
    const { data, error } = await state.admin.from(table).insert(values).select('id').single()
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push([table, data.id])
    return data.id as string
  }
  function use(name: string, workspace?: string) {
    state.actor = { ...actors[name], activeContext: workspace ? { surface: 'admin', tenantType: 'client', tenantId: workspace } : null }
    state.user = clients[name]
    state.host = name === 'admin' ? 'admin.trajectas.com' : ['partner', 'manager'].includes(name) ? 'partner.trajectas.com' : 'client.trajectas.com'
  }
  beforeEach(() => {
    vi.stubEnv('ADMIN_APP_URL', 'https://admin.trajectas.com')
    vi.stubEnv('CLIENT_APP_URL', 'https://client.trajectas.com')
    vi.stubEnv('PARTNER_APP_URL', 'https://partner.trajectas.com')
  })
  beforeAll(async () => {
    state.admin = createAdminClient()
    anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    for (const label of ['A', 'B']) {
      ids[`partner${label}`] = await insert('partners', { name: label, slug: `security-p-${label}-${suffix}` })
      ids[`client${label}`] = await insert('clients', { name: label, slug: `security-c-${label}-${suffix}`, partner_id: ids[`partner${label}`] })
      ids[`assessment${label}`] = await insert('assessments', { title: label, slug: `security-a-${label}-${suffix}`, client_id: ids[`client${label}`], partner_id: ids[`partner${label}`], status: 'active' })
      ids[`campaign${label}`] = await insert('campaigns', { title: label, slug: `security-campaign-${label.toLowerCase()}-${suffix}`, client_id: ids[`client${label}`], partner_id: ids[`partner${label}`], status: 'active' })
      ids[`participant${label}`] = await insert('campaign_participants', { campaign_id: ids[`campaign${label}`], email: `participant-${label}-${suffix}@test.local` })
      ids[`session${label}`] = await insert('participant_sessions', { assessment_id: ids[`assessment${label}`], campaign_id: ids[`campaign${label}`], client_id: ids[`client${label}`], campaign_participant_id: ids[`participant${label}`], status: 'completed' })
      ids[`dimension${label}`] = await insert('dimensions', { name: label, slug: `security-d-${label}-${suffix}`, partner_id: ids[`partner${label}`] })
      ids[`factor${label}`] = await insert('factors', { name: label, slug: `security-f-${label}-${suffix}` })
      ids[`link${label}`] = await insert('assessment_factors', { assessment_id: ids[`assessment${label}`], factor_id: ids[`factor${label}`] })
    }
    for (const [label, audience, released] of [['draft', null, false], ['released', null, true], ['consultant', 'consultant', true], ['hr', 'hr_manager', true]] as const) {
      const template = await insert('report_templates', { name: `security-${label}-${suffix}` })
      ids[label] = await insert('report_snapshots', { template_id: template, campaign_id: ids.campaignA, participant_session_id: ids.sessionA, audience_type: audience, status: released ? 'released' : 'ready', narrative_mode: 'derived', released_at: released ? new Date().toISOString() : null })
    }
    for (const name of ['member', 'other', 'partner', 'manager', 'admin']) {
      const role = name === 'admin' ? 'platform_admin' : ['partner', 'manager'].includes(name) ? 'partner_admin' : 'consultant'
      const user = await createTestUser(state.admin, { email: `security-${name}-${suffix}@test.local`, role })
      users.push(user.userId)
      clients[name] = user.client
      actors[name] = { id: user.userId, email: `security-${name}-${suffix}@test.local`, role, isActive: true, clientMemberships: [], partnerMemberships: [], activeContext: null }
      if (name === 'member' || name === 'other') {
        const clientId = name === 'member' ? ids.clientA : ids.clientB
        const membership = await insert('client_memberships', { profile_id: user.userId, client_id: clientId, role: 'member' })
        actors[name].clientMemberships = [{ id: membership, clientId, role: 'member', isDefault: true, createdAt: new Date().toISOString() }]
      } else if (name === 'partner' || name === 'manager') {
        const membershipRole = name === 'manager' ? 'admin' : 'member'
        const membership = await insert('partner_memberships', { profile_id: user.userId, partner_id: ids.partnerA, role: membershipRole })
        actors[name].partnerMemberships = [{ id: membership, partnerId: ids.partnerA, role: membershipRole, isDefault: true, createdAt: new Date().toISOString() }]
      }
    }
  }, 60000)

  afterAll(async () => {
    for (const [table, id] of rows.reverse()) await state.admin.from(table).delete().eq('id', id)
    for (const id of users) await state.admin.auth.admin.deleteUser(id)
  })

  it.each(['dimensions', 'assessment_factors', 'content_sources', 'item_selection_rules', 'anchor_presets', 'brand_configs', 'forced_choice_blocks', 'forced_choice_block_items'])('denies anonymous direct access to %s', async table => {
    const { data, error } = await anon.from(table).select('*').limit(1)
    expect(data).toBeNull()
    expect(error?.code).toBe('42501')
  })
  it('does not replace anonymous table access with service-role server actions', async () => {
    state.actor = null
    await expect(getContentSources()).rejects.toThrow()
    await expect(getItemSelectionRulesForEstimate()).rejects.toThrow()
  })
  it('keeps private assessment compositions isolated after sign-in', async () => {
    const { data, error } = await clients.member.from('assessment_factors').select('id').in('id', [ids.linkA, ids.linkB])
    expect(error).toBeNull()
    expect(data).toEqual([{ id: ids.linkA }])
  })
  it('keeps partner-owned dimensions isolated', async () => {
    const { data, error } = await clients.partner.from('dimensions').select('id').in('id', [ids.dimensionA, ids.dimensionB])
    expect(error).toBeNull()
    expect(data).toEqual([{ id: ids.dimensionA }])
  })
  it('denies a member the unreleased report and wrong audience', async () => {
    use('member')
    await expect(requireReportSnapshotReadAccess(ids.draft)).rejects.toBeInstanceOf(AuthorizationError)
    await expect(requireReportSnapshotReadAccess(ids.consultant)).rejects.toBeInstanceOf(AuthorizationError)
    await expect(requireReportSnapshotReadAccess(ids.released)).resolves.toMatchObject({ snapshotId: ids.released })
    await expect(requireReportSnapshotReadAccess(ids.hr)).resolves.toMatchObject({ snapshotId: ids.hr })
  })
  it('permits the intended partner audience but denies drafts', async () => {
    use('partner')
    await expect(requireReportSnapshotReadAccess(ids.consultant)).resolves.toMatchObject({ snapshotId: ids.consultant })
    await expect(requireReportSnapshotReadAccess(ids.draft)).rejects.toBeInstanceOf(AuthorizationError)
  })
  it('lets campaign managers preview drafts without crossing tenants or confidentiality boundaries', async () => {
    use('manager')
    await expect(requireReportSnapshotReadAccess(ids.draft)).resolves.toMatchObject({ snapshotId: ids.draft })
    const detail = await getSessionDetail(ids.sessionA)
    expect(detail!.snapshots.map(row => row.id)).toContain(ids.draft)
    expect((await getSessionSnapshots(ids.sessionA)).map(row => row.id)).toContain(ids.draft)
    await expect(getSessionDetail(ids.sessionB)).resolves.toBeNull()
    const campaignId = await insert('campaigns', { title: 'Confidential', slug: `security-aggregate-${suffix}`, client_id: ids.clientA, partner_id: ids.partnerA, status: 'active', confidentiality_mode: 'aggregate_only' })
    const participantId = await insert('campaign_participants', { campaign_id: campaignId, email: `aggregate-${suffix}@test.local` })
    const sessionId = await insert('participant_sessions', { assessment_id: ids.assessmentA, campaign_id: campaignId, client_id: ids.clientA, campaign_participant_id: participantId, status: 'completed' })
    const templateId = await insert('report_templates', { name: `aggregate-${suffix}` })
    const snapshotId = await insert('report_snapshots', { template_id: templateId, campaign_id: campaignId, participant_session_id: sessionId, status: 'ready', narrative_mode: 'derived' })
    await expect(requireReportSnapshotReadAccess(snapshotId)).rejects.toBeInstanceOf(AuthorizationError)
    expect((await getSessionDetail(sessionId))!.snapshots).toEqual([])
    await expect(getSessionSnapshots(sessionId)).resolves.toEqual([])
  })
  it('preserves explicitly enabled local previews but never enables bypass on a public host', async () => {
    state.actor = null
    state.user = anon
    state.host = 'localhost:3002'
    vi.stubEnv('CLIENT_APP_URL', 'http://localhost:3002')
    vi.stubEnv('TRAJECTAS_ALLOW_DEV_BYPASS', '1')
    await expect(requireReportSnapshotReadAccess(ids.draft)).resolves.toMatchObject({ snapshotId: ids.draft })
    expect((await getSessionSnapshots(ids.sessionA)).map(row => row.id)).toContain(ids.draft)
    state.host = 'client.trajectas.com'
    await expect(requireReportSnapshotReadAccess(ids.draft)).rejects.toThrow('Authentication')
  })
  it('denies another client every report', async () => {
    use('other')
    await expect(requireReportSnapshotReadAccess(ids.released)).rejects.toBeInstanceOf(AuthorizationError)
  })
  it('filters blocked report metadata out of session detail', async () => {
    use('member')
    const detail = await getSessionDetail(ids.sessionA)
    expect(detail).not.toBeNull()
    expect(detail!.snapshots.map(row => row.id).sort()).toEqual([ids.released, ids.hr].sort())
  })
  it('confines an admin selected into another client across session, drilldown, and report reads', async () => {
    use('admin', ids.clientB)
    await expect(getSessionDetail(ids.sessionA)).resolves.toBeNull()
    await expect(getConstructScoresForFactor(ids.sessionA, ids.factorA)).rejects.toBeInstanceOf(AuthorizationError)
    await expect(requireReportSnapshotReadAccess(ids.released)).rejects.toBeInstanceOf(AuthorizationError)
    use('admin', ids.clientA)
    await expect(getSessionDetail(ids.sessionA)).resolves.toMatchObject({ id: ids.sessionA })
  })
  it('preserves unconfined administrator draft review', async () => {
    use('admin')
    await expect(requireReportSnapshotReadAccess(ids.draft)).resolves.toMatchObject({ snapshotId: ids.draft })
  })
})
