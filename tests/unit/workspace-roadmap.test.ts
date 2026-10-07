import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultWorkspaceFeatures, DISABLED_WORKSPACE_FEATURES, FEATURE_DEPENDENCIES, MODULE_FEATURES, previewFeatureChange, validateWorkspaceFeatures, WORKSPACE_FEATURE_KEYS, featureForWorkspacePath } from '@/lib/features/workspace-features'
import { workspacePreset, WORKSPACE_PRESETS, workspaceFeatureDiff } from '@/lib/features/workspace-presets'
import { workspaceFeatureConfigurationSchema } from '@/lib/validations/workspace-features'
const state = vi.hoisted(() => ({ config: {} as Record<string, unknown>, query: vi.fn() }))
vi.mock('@/lib/dal/workspace-features', () => ({ getEffectiveWorkspaceFeatures: async () => state.config, getIntegrationClientFeatures: async () => state.config }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: state.query }))
import { requireWorkspaceFeature } from '@/lib/features/access'
import { requireIntegrationClientFeature } from '@/lib/features/integration-access'
import { createCampaign, activateCampaign, inviteParticipant, bulkInviteParticipants } from '@/app/actions/campaigns'
import { createAssessmentDraft, updateAssessmentMeta } from '@/app/actions/assessments'
import { createReportTemplate, regenerateSnapshot, addAssessmentTemplate } from '@/app/actions/reports'
import { assignAssessment, toggleReportTemplateAssignment } from '@/app/actions/client-entitlements'
import { createIntegrationLaunch } from '@/lib/integrations/service'
import { authorizeWorkspaceExport, authorizeWorkspaceUsageExport } from '@/app/actions/workspace-features'

beforeEach(() => { state.config = defaultWorkspaceFeatures('partner'); state.query.mockReset() })
describe('workspace roadmap compatibility and dependencies', () => {
  it.each(['partner', 'client'] as const)('preserves published tools with no settings in %s', type => {
    const features = defaultWorkspaceFeatures(type)
    expect(features.assessmentDelivery).toBe(true)
    expect(features.reportViewing).toBe(true)
    expect(features.participantInvitations).toBe(true)
    expect(features.workspaceAssistant).toBe(true) // availability never grants its existing admin-only role
    expect(features.clientProvisioning).toBe(type === 'partner')
    expect(features.unifiedTrajectory).toBe(type === 'partner')
    expect(() => validateWorkspaceFeatures(features, type)).not.toThrow()
  })
  it.each(WORKSPACE_PRESETS)('$label v1 has independent insights and compatible dependencies', preset => {
    const features = workspacePreset(preset.id, preset.tenantType)
    expect(() => validateWorkspaceFeatures(features, preset.tenantType)).not.toThrow()
    expect(features).toMatchObject({ compare: false, trajectory: false, unifiedTrajectory: false, workspaceAssistant: false, orgDiagnostics: false, integrationLaunches: false, outcomeStudies: false })
  })
  it('starter cannot provision clients or author content; full partner can', () => {
    expect(workspacePreset('partnerStarter', 'partner')).toMatchObject({ clientDirectory: true, clientProvisioning: false, clientManagement: false, assessmentAuthoring: false, reportTemplateAuthoring: false })
    expect(workspacePreset('fullPartner', 'partner')).toMatchObject({ clientProvisioning: true, assessmentPublishing: true, reportTemplateAuthoring: true })
    expect(() => workspacePreset('fullPartner', 'client')).toThrow('compatible')
  })
  it.each(Object.entries(FEATURE_DEPENDENCIES))('%s requires its declared prerequisites and previews disabling them', (dependent, requirements) => {
    for (const required of requirements) {
      const features = { ...defaultWorkspaceFeatures('partner'), [required]: false }
      expect(() => validateWorkspaceFeatures(features, 'partner')).toThrow('requires')
      const next = previewFeatureChange(defaultWorkspaceFeatures('partner'), required, false)
      expect(next[dependent as keyof typeof next]).toBe(false)
      expect(next.compare).toBe(true); expect(next.trajectory).toBe(true); expect(next.unifiedTrajectory).toBe(true)
      expect(workspaceFeatureDiff(defaultWorkspaceFeatures('partner'), next).some(entry => entry.key === dependent)).toBe(true)
      expect(() => validateWorkspaceFeatures(next, 'partner')).not.toThrow()
    }
  })
  it('proposes transitive enable prerequisites only for explicit reviewed application', () => {
    const initial = { ...DISABLED_WORKSPACE_FEATURES }
    expect(() => previewFeatureChange(initial, 'assessmentPublishing', true)).toThrow('Enable')
    expect(previewFeatureChange(initial, 'assessmentPublishing', true, true)).toMatchObject({ assessmentLibrary: true, assessmentAuthoring: true, assessmentPublishing: true, assessmentDelivery: false, compare: false, campaignViewing: false })
    expect(initial.assessmentLibrary).toBe(false)
    expect(previewFeatureChange(initial, 'assessmentDelivery', true, true)).toMatchObject({ assessmentLibrary: true, assessmentDelivery: true, assessmentAuthoring: false })
  })
  it('keeps historical viewing and role grants separate from disabling new delivery', () => {
    const next = previewFeatureChange(defaultWorkspaceFeatures('client'), 'assessmentDelivery', false)
    expect(next).toMatchObject({ reportViewing: true, campaignViewing: true, assessmentLibrary: true, feedback360: false, integrationLaunches: false })
    expect(next).not.toHaveProperty('role')
  })
  it('accepts explicit client Unified, rejects client partner controls and forged keys', () => {
    expect(() => validateWorkspaceFeatures({ ...defaultWorkspaceFeatures('client'), unifiedTrajectory: true }, 'client')).not.toThrow()
    expect(() => validateWorkspaceFeatures({ ...defaultWorkspaceFeatures('client'), clientDirectory: true }, 'client')).toThrow('partner')
    expect(workspaceFeatureConfigurationSchema.safeParse({ ...defaultWorkspaceFeatures('client'), role: 'platform_admin' }).success).toBe(false)
    expect(workspaceFeatureConfigurationSchema.safeParse({ ...defaultWorkspaceFeatures('client'), reportViewing: undefined }).success).toBe(false)
  })
  it.each([['/partner/assessments/create','assessmentAuthoring'],['/client/campaigns','campaignViewing'],['/partner/clients/create','clientProvisioning'],['/client/participants/unified','unifiedTrajectory'],['/partner/usage','usageVisibility']])('maps bookmarked %s to availability', (path,key) => expect(featureForWorkspacePath(path)).toBe(key))
})
describe('new operations combine availability with existing authority', () => {
  it.each(WORKSPACE_FEATURE_KEYS)('requires %s individually', async feature => {
    await expect(requireWorkspaceFeature(feature)).resolves.toBeUndefined()
    state.config = { ...defaultWorkspaceFeatures('partner'), [feature]: false }
    await expect(requireWorkspaceFeature(feature)).rejects.toThrow('not enabled')
  })
  it.each([
    ['campaignManagement', () => createCampaign({})],
    ['assessmentDelivery', () => activateCampaign('synthetic')],
    ['feedback360', () => createCampaign({ title: 'Synthetic 360', slug: 'synthetic-360', kind: 'leadership_360' })],
    ['assessmentDelivery', () => inviteParticipant('synthetic', {})],
    ['assessmentDelivery', () => bulkInviteParticipants('synthetic', [])],
    ['participantInvitations', () => inviteParticipant('synthetic', {})],
    ['participantInvitations', () => bulkInviteParticipants('synthetic', [])],
    ['assessmentAuthoring', () => createAssessmentDraft({ title: 'Synthetic' })],
    ['assessmentPublishing', () => updateAssessmentMeta('synthetic', { status: 'active' })],
    ['reportTemplateAuthoring', () => createReportTemplate({ name: 'Synthetic', reportType: 'self_report', displayLevel: 'factor' })],
    ['reportGeneration', () => regenerateSnapshot('synthetic')],
    ['reportTemplateLibrary', () => addAssessmentTemplate('synthetic', 'synthetic')],
    ['clientAssessmentAllocation', () => assignAssessment('synthetic', { assessmentId: 'synthetic' })],
    ['clientTemplateAllocation', () => toggleReportTemplateAssignment('synthetic','synthetic',true)],
  ] as const)('disabled %s prevents mutation before a service database is opened', async (feature, operation) => {
    state.config = { ...defaultWorkspaceFeatures('partner'), [feature]: false }
    await expect(operation()).rejects.toThrow('not enabled')
    expect(state.query).not.toHaveBeenCalled()
  })
  it('does not let starter client-directory availability unlock client allocation',async()=>{
    state.config=workspacePreset('partnerStarter','partner')
    await expect(requireWorkspaceFeature('clientDirectory')).resolves.toBeUndefined()
    await expect(assignAssessment('synthetic',{assessmentId:'synthetic'})).rejects.toThrow('not enabled')
    await expect(toggleReportTemplateAssignment('synthetic','synthetic',true)).rejects.toThrow('not enabled')
    expect(state.query).not.toHaveBeenCalled()
  })
  it('blocks new integration launch while leaving integration reads outside the launch gate', async () => {
    state.config = { ...defaultWorkspaceFeatures('client'), integrationLaunches: false }
    await expect(requireIntegrationClientFeature('synthetic','integrationLaunches')).rejects.toMatchObject({ status: 403, code: 'workspace_feature_disabled' })
    await expect(createIntegrationLaunch({ clientId: 'synthetic' } as never,'synthetic',{ participantId: 'synthetic', deliveryMethod:'link' })).rejects.toMatchObject({ status:403 })
    expect(state.query).not.toHaveBeenCalled()
  })
  it('reauthorizes client-side exports for the exact experience and format', async () => {
    state.config = { ...defaultWorkspaceFeatures('client'), trajectory: true, compare: false, insightCsvExport: false, reportDownload: true }
    expect(await authorizeWorkspaceExport('individual','csv')).toHaveProperty('error')
    expect(await authorizeWorkspaceExport('individual','pdf')).toEqual({ success:true })
    expect(await authorizeWorkspaceExport('compare','pdf')).toHaveProperty('error')
    expect(await authorizeWorkspaceExport('admin','pdf')).toHaveProperty('error')
  })
  it('reauthorizes usage downloads independently of insight CSV and billing', async () => {
    state.config = { ...defaultWorkspaceFeatures('client'), insightCsvExport: false, billingVisibility: false }
    expect(await authorizeWorkspaceUsageExport()).toEqual({ success: true })
    state.config.usageVisibility = false
    expect(await authorizeWorkspaceUsageExport()).toHaveProperty('error')
  })
  it('denies every module in an empty context', async () => {
    state.config = DISABLED_WORKSPACE_FEATURES
    for (const capability of MODULE_FEATURES) await expect(requireWorkspaceFeature(capability.key)).rejects.toThrow('not enabled')
  })
})

describe('assistant tools enforce their own module before querying', () => {
  it('blocks an enabled assistant from calling a disabled campaign module', async () => {
    const { defineChatTool } = await import('@/lib/chat/registry')
    const { z } = await import('zod')
    const execute = vi.fn().mockResolvedValue({ ok: true })
    const tool = defineChatTool({ name: 'synthetic-campaign', description:'Synthetic', statusLabel:'Synthetic', params:z.object({}), requiredFeatures:['campaignViewing'], execute })
    state.config = { ...defaultWorkspaceFeatures('partner'), campaignViewing:false }
    await expect(tool.execute({}, {} as never)).rejects.toThrow('not enabled')
    expect(execute).not.toHaveBeenCalled()
    state.config = defaultWorkspaceFeatures('partner')
    await expect(tool.execute({}, {} as never)).resolves.toEqual({ ok:true })
  })
})
