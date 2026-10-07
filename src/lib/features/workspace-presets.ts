import { DISABLED_WORKSPACE_FEATURES, WORKSPACE_FEATURE_KEYS, type FeatureTenant, type WorkspaceFeatures } from './workspace-features'
/** Immutable version-one provisioning choices; never applied to existing workspaces automatically. */
export const WORKSPACE_PRESETS = [
  { id: 'client', version: 1, tenantType: 'client', label: 'Client', dashboardStyle: 'operational', enabled: ['assessmentLibrary', 'assessmentDelivery', 'campaignViewing', 'campaignManagement', 'participantInvitations', 'reportViewing', 'reportGeneration', 'reportTemplateLibrary', 'usageVisibility'] },
  { id: 'partnerStarter', version: 1, tenantType: 'partner', label: 'Partner starter', dashboardStyle: 'operational', enabled: ['assessmentLibrary', 'assessmentDelivery', 'campaignViewing', 'campaignManagement', 'participantInvitations', 'reportViewing', 'reportGeneration', 'reportTemplateLibrary', 'usageVisibility', 'clientDirectory'] },
  { id: 'fullPartner', version: 1, tenantType: 'partner', label: 'Full partner', dashboardStyle: 'portfolio', enabled: ['assessmentLibrary', 'assessmentDelivery', 'assessmentAuthoring', 'assessmentPublishing', 'campaignViewing', 'campaignManagement', 'participantInvitations', 'reportViewing', 'reportGeneration', 'reportTemplateLibrary', 'reportTemplateAuthoring', 'clientDirectory', 'clientProvisioning', 'clientManagement', 'clientAssessmentAllocation', 'clientTemplateAllocation', 'usageVisibility'] },
] as const
export type WorkspacePresetId = typeof WORKSPACE_PRESETS[number]['id']
export function workspacePreset(id: WorkspacePresetId, tenantType: FeatureTenant['type']): WorkspaceFeatures {
  const preset = WORKSPACE_PRESETS.find(p => p.id === id && p.tenantType === tenantType)
  if (!preset) throw new Error('Choose a compatible workspace preset.')
  const enabled: readonly string[] = preset.enabled
  return { ...DISABLED_WORKSPACE_FEATURES, ...Object.fromEntries(WORKSPACE_FEATURE_KEYS.map(key => [key, enabled.includes(key)])), dashboardStyle: preset.dashboardStyle }
}
export function workspaceFeatureDiff(before: WorkspaceFeatures, after: WorkspaceFeatures) {
  return [...WORKSPACE_FEATURE_KEYS, 'dashboardStyle' as const].filter(key => before[key] !== after[key]).map(key => ({ key, before: before[key], after: after[key] }))
}
