import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ from: vi.fn(), asset: vi.fn(), campaign: vi.fn(), admin: vi.fn(), filters: vi.fn(), scopeFilter: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: mocks.from }) }))
vi.mock('@/lib/auth/authorization', () => ({ resolveAuthorizedScope: async () => ({}), requireAssessmentAccess: mocks.asset, requireCampaignAccess: mocks.campaign, requireAdminScope: mocks.admin, resolveTenantClientFilter: mocks.scopeFilter, canManageCampaign: () => true }))
import { listNormReferences, getCampaignReferenceSettings } from '@/lib/dal/norm-references'
const instrument = 'ipip-neo-120-johnson-2014'
const form = { assessment_id: 'assessment', instrument_id: instrument, definition: { formVersion: 'form-v1', itemsetSha256: 'correct-hash' } }
const artifact = JSON.stringify({ rawN: 100, kishEffectiveN: 90, ageBoundsInclusive: [18,64], countryLabels: null, weighting: 'pooled' })
const valid = { id: 'compatible', instrument_id: instrument, form_version: 'form-v1', scoring_version: 'ipip-neo-120-raw-v1', itemset_sha256: 'correct-hash', method_version: 'weighted-empirical-midrank-v1', artifact_text: artifact, status: 'active' }
const versions = [valid, { ...valid, id: 'wrong-form', itemset_sha256: 'different-hash' }, { ...valid, id: 'other-method', method_version: 'unimplemented-method' }]
function query(data: unknown) { const result = { data, error: null }; const q = { select: () => q, eq: () => q, is: () => q, in: () => q, or: (s: string) => { mocks.filters(s); return q }, order: () => q, single: async () => result, maybeSingle: async () => result, then: (f: (r: typeof result) => unknown) => Promise.resolve(result).then(f) }; return q }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.scopeFilter.mockReturnValue(null)
  mocks.campaign.mockResolvedValue({ scope: {}, clientId: 'client', partnerId: null })
  mocks.from.mockImplementation(table => query(({ norm_reference_versions: versions, assessment_norm_references: versions.map(v => ({ assessment_id: 'assessment', reference_version_id: v.id, is_default: v.id === 'compatible', assessments: { id: 'assessment', title: 'Personality' } })), standardized_assessment_forms: [form], campaigns: { status: 'draft' }, campaign_assessments: [{ id: 'link', assessment_id: 'assessment', reference_version_id: null, assessments: { title: 'Personality' } }], participant_sessions: [] } as Record<string, unknown>)[table]))
})
it('filters invalid measurement contracts even if a compatibility mapping was mistakenly present', async () => {
  const original = mocks.from.getMockImplementation()!
  mocks.from.mockImplementation(table => table === 'standardized_assessment_forms' ? query(form) : original(table))
  expect((await listNormReferences('assessment')).map(r => r.id)).toEqual(['compatible'])
  expect(mocks.asset).toHaveBeenCalledWith('assessment')
})
it('only offers compatible versions on the campaign selector and explicitly applies client scope', async () => {
  expect((await getCampaignReferenceSettings('campaign')).assessments[0].references.map(r => r.id)).toEqual(['compatible'])
  expect(mocks.filters).toHaveBeenCalledWith('scope_client_id.is.null,scope_client_id.eq.client')
})
it('retains invalid or draft catalog records for the separate platform review view', async () => {
  expect(await listNormReferences(undefined, true)).toHaveLength(3)
  expect(mocks.admin).toHaveBeenCalledOnce()
})
it('returns actual assessment assignments and defaults in the unrestricted catalog and campaign choices', async () => {
  expect((await listNormReferences(undefined, true))[0]).toMatchObject({ isDefault: true, assessments: [{ id: 'assessment', title: 'Personality', isDefault: true }] })
  expect((await getCampaignReferenceSettings('campaign')).assessments[0].references[0]).toMatchObject({ isDefault: true, assessments: [{ id: 'assessment', title: 'Personality', isDefault: true }] })
})
it('does not discover other assessment titles through shared references from a confined workspace', async () => {
  mocks.scopeFilter.mockReturnValue(['client'])
  expect((await listNormReferences(undefined, true)).every(r => r.assessments?.length === 0)).toBe(true)
  expect(mocks.from).not.toHaveBeenCalledWith('assessment_norm_references')
})
