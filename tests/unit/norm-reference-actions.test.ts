import { beforeEach, describe, expect, it, vi } from 'vitest'
const ids = { session: '11111111-1111-4111-8111-111111111111', campaign: '22222222-2222-4222-8222-222222222222', template: '33333333-3333-4333-8333-333333333333', ref: '44444444-4444-4444-8444-444444444444', snapshot: '55555555-5555-4555-8555-555555555555' }
const mocks = vi.hoisted(() => ({ access: vi.fn(), manage: vi.fn(), admin: vi.fn(), canManage: vi.fn(), individual: vi.fn(), rpc: vi.fn(), from: vi.fn(), rlsFrom: vi.fn(), settings: vi.fn(), audit: vi.fn(), after: vi.fn(), list: vi.fn(), client: vi.fn() }))
vi.mock('@/lib/auth/authorization', () => ({ requireSessionAccess: mocks.access, requireCampaignManage: mocks.manage, requireAdminScope: mocks.admin, requireClientAccess: mocks.client, canManageCampaign: mocks.canManage, assertIndividualResultsAccess: mocks.individual, requireAssessmentAccess: vi.fn(), requireReportSnapshotAccess: mocks.access, resolveTenantClientFilter: () => null }))
vi.mock('@/lib/features/access', () => ({ requireWorkspaceFeature: vi.fn(), isWorkspaceFeatureEnabled: async () => true }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: mocks.from, rpc: mocks.rpc }) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from: mocks.rlsFrom }) }))
vi.mock('@/lib/dal/norm-references', () => ({ getCampaignReferenceSettings: mocks.settings, listNormReferences: mocks.list }))
vi.mock('@/lib/auth/support-sessions', () => ({ logAuditEvent: mocks.audit }))
vi.mock('@/lib/reports/runner', () => ({ processSnapshot: vi.fn() }))
vi.mock('next/server', () => ({ after: mocks.after }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
import { createReferenceReportEdition, getSessionReferenceWorkspace, updateReferenceReview, setCampaignAssessmentReference, getCampaignSetupReferenceChoices } from '@/app/actions/norm-references'
import { IPIP_DATABASE } from '@/lib/instrument/ipip-neo-120/database-form'
const input = () => ({ sessionId: ids.session, templateId: ids.template, referenceId: ids.ref, requestId: '66666666-6666-4666-8666-666666666666', parentSnapshotId: null })
function query(data: unknown) {
  const result = { data, error: null }
  const chain = { select: () => chain, eq: () => chain, is: () => chain, in: () => chain, order: () => chain, update: () => chain, single: async () => result, then: (fn: (r: typeof result) => unknown) => Promise.resolve(result).then(fn) }
  return chain
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.access.mockResolvedValue({ campaignId: ids.campaign, clientId: 'client', partnerId: 'partner', scope: { actor: { id: 'actor' } }, confidentialityMode: 'standard' })
  mocks.manage.mockResolvedValue({ scope: { actor: { id: 'actor' } }, clientId: 'client', partnerId: 'partner' })
  mocks.canManage.mockReturnValue(true)
  mocks.settings.mockResolvedValue({ assessments: [{ assessmentId: IPIP_DATABASE.assessmentId, referenceVersionId: ids.ref, references: [{ id: ids.ref, status: 'active' }] }] })
  mocks.from.mockImplementation(table => query(({ participant_sessions: { assessment_id: IPIP_DATABASE.assessmentId, status: 'completed' }, report_snapshots: [], campaign_report_templates: [{ template_id: ids.template }], assessment_report_templates: [], norm_reporting_capabilities: { editions_enabled: true }, report_templates: [{ id: ids.template, name: 'Comparison' }], campaign_assessments: { id: ids.ref } } as Record<string, unknown>)[table]))
  mocks.rlsFrom.mockReturnValue(query([]))
  mocks.rpc.mockResolvedValue({ data: ids.snapshot, error: null })
})
describe('reference reporting action authorization', () => {
  it.each(['client manager', 'partner manager'])('lets an authorised %s create a scoped comparison for later review', async () => {
    expect(await createReferenceReportEdition(input())).toEqual({ id: ids.snapshot })
    expect(mocks.manage).toHaveBeenCalledWith(ids.campaign)
    expect(mocks.individual).toHaveBeenCalled()
    expect(mocks.rpc).toHaveBeenCalledWith('enqueue_reference_report', expect.objectContaining({ p_reference_id: ids.ref, p_automatic: false }))
    expect(mocks.after).toHaveBeenCalledOnce()
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'report.edition.requested' }))
  })
  it('rejects a non-manager before creating or starting a report', async () => {
    mocks.manage.mockRejectedValue(new Error('Unauthorized'))
    await expect(createReferenceReportEdition(input())).rejects.toThrow('Unauthorized')
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(mocks.after).not.toHaveBeenCalled()
  })
  it('rejects an unapproved or incompatible reference', async () => {
    mocks.settings.mockResolvedValue({ assessments: [{ assessmentId: IPIP_DATABASE.assessmentId, references: [{ id: ids.ref, status: 'draft' }] }] })
    await expect(createReferenceReportEdition(input())).rejects.toThrow('unavailable or incompatible')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('keeps ordinary members on the existing report RLS path', async () => {
    mocks.canManage.mockReturnValue(false)
    expect((await getSessionReferenceWorkspace(ids.session)).canCreate).toBe(false)
    expect(mocks.rlsFrom).toHaveBeenCalledWith('report_snapshots')
    expect(mocks.from).not.toHaveBeenCalledWith('report_snapshots')
  })
  it('does not let aggregate-only access reach report history', async () => {
    mocks.individual.mockImplementationOnce(() => { throw new Error('Individual access unavailable') })
    await expect(getSessionReferenceWorkspace(ids.session)).rejects.toThrow('Individual access unavailable')
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('keeps reference review separate from campaign management', async () => {
    mocks.admin.mockRejectedValue(new Error('Administrator required'))
    await expect(updateReferenceReview({})).rejects.toThrow('Administrator required')
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('limits setup choices to active global or matching-client versions', async () => {
    mocks.list.mockResolvedValue([{ id: 'global', status: 'active', scopeClientId: null }, { id: 'own', status: 'active', scopeClientId: ids.campaign, isDefault: true }, { id: 'other', status: 'active', scopeClientId: ids.ref }, { id: 'draft', status: 'draft', scopeClientId: null }])
    expect(await getCampaignSetupReferenceChoices(ids.ref, ids.campaign)).toEqual({ references: [expect.objectContaining({ id: 'global' }), expect.objectContaining({ id: 'own' })], defaultId: 'own' })
    expect(mocks.client).toHaveBeenCalledWith(ids.campaign)
    expect(mocks.list).toHaveBeenCalledWith(ids.ref)
  })
  it('requires campaign management for a campaign default change', async () => {
    mocks.manage.mockRejectedValue(new Error('Unauthorized'))
    await expect(setCampaignAssessmentReference({ campaignId: ids.campaign, campaignAssessmentId: ids.ref, referenceId: ids.ref })).rejects.toThrow('Unauthorized')
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
