/** Serializable workspace capabilities. Entity access and staff roles remain separate. */
export const INSIGHT_FEATURES = [
  { key: 'compare', label: 'Compare', description: 'Compare participants side by side, including saved comparisons and campaign comparisons.' },
  { key: 'trajectory', label: 'Trajectory', description: 'Explore one person’s results and linked assessment history over time.' },
  { key: 'unifiedTrajectory', label: 'Unified Trajectory', description: 'Explore multiple people and their assessment histories in one workspace.' },
] as const
export type InsightFeature = typeof INSIGHT_FEATURES[number]['key']
export type InsightExperience = 'compare' | 'individual' | 'unified'
export type DashboardStyle = 'default' | 'operational' | 'portfolio'
export const MODULE_FEATURES = [
  { key: 'assessmentLibrary', group: 'Assessments', label: 'Assigned assessment library', description: 'Browse allocated assessments. Individual allocations still apply.' },
  { key: 'assessmentDelivery', group: 'Assessments', label: 'Assessment delivery', description: 'Start new delivery from allocated content. Enrolled participants can finish.' },
  { key: 'assessmentAuthoring', group: 'Assessments', label: 'Assessment authoring', description: 'Create and edit owned assessments.' },
  { key: 'assessmentPublishing', group: 'Assessments', label: 'Assessment publishing', description: 'Activate owned drafts after existing content review checks.' },
  { key: 'campaignViewing', group: 'Campaigns', label: 'Campaign viewing', description: 'Browse campaigns and participant history.' },
  { key: 'campaignManagement', group: 'Campaigns', label: 'Campaign management', description: 'Create and manage campaigns. New launches also require delivery.' },
  { key: 'participantInvitations', group: 'Campaigns', label: 'Participant invitations', description: 'Add/import participants, issue invitations and send reminders.' },
  { key: 'reportViewing', group: 'Reports', label: 'Existing reports', description: 'View authorised generated reports.' },
  { key: 'reportGeneration', group: 'Reports', label: 'New report generation', description: 'Request new reports using allocated templates. Existing processing continues.' },
  { key: 'reportTemplateLibrary', group: 'Reports', label: 'Template library', description: 'Browse allocated report templates.' },
  { key: 'reportTemplateAuthoring', group: 'Reports', label: 'Template authoring', description: 'Create, edit and preview owned report templates.' },
  { key: 'clientDirectory', group: 'Partners', label: 'Client directory', description: 'Browse the partner’s assigned clients.', partnerOnly: true },
  { key: 'clientProvisioning', group: 'Partners', label: 'Client provisioning', description: 'Create clients within existing partner-admin permissions.', partnerOnly: true },
  { key: 'clientManagement', group: 'Partners', label: 'Client management', description: 'Edit assigned clients within existing manage permissions.', partnerOnly: true },
  { key: 'clientAssessmentAllocation', group: 'Partners', label: 'Client assessment allocation', description: 'Allocate assessments within the partner’s pool and quota caps.', partnerOnly: true },
  { key: 'clientTemplateAllocation', group: 'Partners', label: 'Client template allocation', description: 'Allocate eligible templates to assigned clients.', partnerOnly: true },
  { key: 'usageVisibility', group: 'Business', label: 'Usage reporting', description: 'View period-based usage and campaign breakdowns.' },
  { key: 'feedback360', group: 'Campaigns', label: '360 feedback delivery', description: 'Configure existing 360 campaigns within current platform-only rater permissions.' },
  { key: 'participantExperience', group: 'Campaigns', label: 'Participant experience', description: 'Customise campaign introductions and flow; enrolled participants retain the issued experience.' },
  { key: 'insightCsvExport', group: 'Exports', label: 'Insight CSV', description: 'Export an enabled insight with its existing data and role checks.' },
  { key: 'reportDownload', group: 'Exports', label: 'Report downloads', description: 'Download authorised reports and insight snapshots. Participant token access is retained.' },
  { key: 'campaignBranding', group: 'Branding', label: 'Campaign branding', description: 'Edit participant branding within the existing brand permissions.' },
  { key: 'teamManagement', group: 'People', label: 'Team management', description: 'Manage workspace staff within existing admin-role and active-account checks.' },
  { key: 'personIdentityManagement', group: 'People', label: 'Identity correction', description: 'Link or unlink participant identity within existing client boundaries and audit rules.' },
  { key: 'orgDiagnostics', group: 'Diagnostics', label: 'Organisational diagnostics', description: 'Use existing diagnostic sessions within their current ownership and role limits.' },
  { key: 'roleMatching', group: 'Hiring', label: 'Role matching', description: 'Use existing workspace matching tools. Public Role Builder remains available.' },
  { key: 'outcomeStudies', group: 'Outcomes', label: 'Outcome studies', description: 'Configure and analyse existing client-owned outcome studies.' },
  { key: 'outcomeReports', group: 'Outcomes', label: 'Business outcome reports', description: 'Create and view authorised outcome reports.' },
  { key: 'integrationManagement', group: 'Integrations', label: 'Connection management', description: 'Manage existing approved connections within current credential and role restrictions.' },
  { key: 'integrationLaunches', group: 'Integrations', label: 'External assessment launches', description: 'Create new integration launches using client-allocated content and quotas. Existing launches continue.' },
  { key: 'webhookDelivery', group: 'Integrations', label: 'Webhook delivery', description: 'Send client-owned integration events. Paused events are saved for explicit backlog review; re-enabling does not release them.' },
  { key: 'workspaceAssistant', group: 'AI', label: 'Workspace assistant', description: 'Use the existing assistant where the current role and portal permit it.' },
  { key: 'billingVisibility', group: 'Business', label: 'Billing visibility', description: 'View currently permitted commercial information; invoices and charging continue.' },
] as const
export function workspaceFeatureLabel(key: string): string {
  return [...INSIGHT_FEATURES, ...MODULE_FEATURES].find(feature => feature.key === key)?.label ?? 'Dashboard style'
}
export type ModuleFeature = typeof MODULE_FEATURES[number]['key']
export type WorkspaceFeature = InsightFeature | ModuleFeature
export const WORKSPACE_FEATURE_KEYS: WorkspaceFeature[] = [...INSIGHT_FEATURES, ...MODULE_FEATURES].map(f => f.key)
export type WorkspaceFeatures = Record<WorkspaceFeature, boolean> & { dashboardStyle: DashboardStyle }
export type FeatureSettingKey = WorkspaceFeature | 'dashboardStyle'
export type FeatureTenant = { type: 'partner' | 'client'; id: string }
export const EXPERIENCE_FEATURE: Record<InsightExperience, InsightFeature> = {
  compare: 'compare', individual: 'trajectory', unified: 'unifiedTrajectory',
}
export const FEATURE_DEPENDENCIES: Partial<Record<WorkspaceFeature, WorkspaceFeature[]>> = {
  assessmentAuthoring: ['assessmentLibrary'],
  assessmentDelivery: ['assessmentLibrary'],
  assessmentPublishing: ['assessmentAuthoring'],
  feedback360: ['campaignManagement', 'assessmentDelivery'],
  integrationLaunches: ['assessmentDelivery'],
  reportTemplateAuthoring: ['reportTemplateLibrary'],
  clientProvisioning: ['clientDirectory'], clientManagement: ['clientDirectory'],
  clientAssessmentAllocation: ['clientDirectory'], clientTemplateAllocation: ['clientDirectory'],
}
/** Explicit compatibility defaults preserve published tools, including historical access. */
export function defaultWorkspaceFeatures(type: FeatureTenant['type'] | 'admin'): WorkspaceFeatures {
  const modules = Object.fromEntries(MODULE_FEATURES.map(f => [f.key, type !== 'client' || !('partnerOnly' in f)])) as Record<ModuleFeature, boolean>
  return { ...modules, compare: true, trajectory: true, unifiedTrajectory: type !== 'client', dashboardStyle: 'default' }
}
export const DISABLED_WORKSPACE_FEATURES: WorkspaceFeatures = {
  ...Object.fromEntries(WORKSPACE_FEATURE_KEYS.map(key => [key, false])) as Record<WorkspaceFeature, boolean>, dashboardStyle: 'default',
}
/** Aggregate contexts intersect every capability, including independent insights. */
export function intersectWorkspaceFeatures(configs: WorkspaceFeatures[]): WorkspaceFeatures {
  if (!configs.length) return { ...DISABLED_WORKSPACE_FEATURES }
  return {
    ...Object.fromEntries(WORKSPACE_FEATURE_KEYS.map(key => [key, configs.every(c => c[key])])) as Record<WorkspaceFeature, boolean>,
    dashboardStyle: configs.every(c => c.dashboardStyle === configs[0].dashboardStyle) ? configs[0].dashboardStyle : 'default',
  }
}
export function validateWorkspaceFeatures(features: WorkspaceFeatures, type: FeatureTenant['type']) {
  if (type === 'client' && features.dashboardStyle === 'portfolio') throw new Error('Portfolio dashboards require a partner workspace.')
  for (const feature of MODULE_FEATURES) {
    if (type === 'client' && 'partnerOnly' in feature && features[feature.key]) throw new Error(`${feature.label} requires a partner workspace.`)
  }
  for (const [key, dependencies] of Object.entries(FEATURE_DEPENDENCIES)) {
    if (features[key as WorkspaceFeature] && dependencies.some(dependency => !features[dependency])) throw new Error(`${workspaceFeatureLabel(key)} requires ${dependencies.map(workspaceFeatureLabel).join(', ')}.`)
  }
}
export function previewFeatureChange(current: WorkspaceFeatures, key: FeatureSettingKey, value: boolean | DashboardStyle, reviewPrerequisites = false): WorkspaceFeatures {
  if (!reviewPrerequisites && value === true && (FEATURE_DEPENDENCIES[key as WorkspaceFeature] ?? []).some(dependency => !current[dependency])) {
    throw new Error(`Enable ${(FEATURE_DEPENDENCIES[key as WorkspaceFeature] ?? []).map(workspaceFeatureLabel).join(', ')} first.`)
  }
  const next = { ...current, [key]: value }
  // This is a proposal only. The settings UI requires an explicit reviewed batch.
  if (value === true && reviewPrerequisites) {
    const propose = (feature: WorkspaceFeature) => {
      for (const prerequisite of FEATURE_DEPENDENCIES[feature] ?? []) {
        next[prerequisite] = true
        propose(prerequisite)
      }
    }
    propose(key as WorkspaceFeature)
  }
  // Disabling a prerequisite proposes the complete transitive cascade for explicit approval.
  let changed: boolean
  do {
    changed = false
    for (const [dependent, dependencies] of Object.entries(FEATURE_DEPENDENCIES)) {
      const feature = dependent as WorkspaceFeature
      if (next[feature] && dependencies.some(dependency => !next[dependency])) { next[feature] = false; changed = true }
    }
  } while (changed)
  return next
}
export function featureForInsightPath(path: string): InsightFeature | null {
  if (/\/participants\/unified(?:\/|$)/.test(path)) return 'unifiedTrajectory'
  if (/\/participants\/trajectory(?:\/|$)/.test(path)) return 'trajectory'
  if (/\/(?:participants|campaigns\/[^/]+)\/compare(?:\/|$)/.test(path)) return 'compare'
  return null
}

export class MultipleTrajectoryPeopleError extends Error {
  constructor() { super('Individual Trajectory supports one person. Open Unified Trajectory to explore multiple people.'); this.name = 'MultipleTrajectoryPeopleError' }
}

/** Navigation and route availability; data/role checks are still authoritative. */
export function featureForWorkspacePath(path: string): WorkspaceFeature | null {
  const insight = featureForInsightPath(path)
  if (insight) return insight
  const normalized = path.replace(/^\/(partner|client)(?=\/)/, '')
  if (/^\/assessments\/(create|[^/]+\/edit)(\/|$)/.test(normalized)) return 'assessmentAuthoring'
  if (/^\/assessments(\/|$)/.test(normalized)) return 'assessmentLibrary'
  if (/^\/campaigns\/create(\/|$)/.test(normalized)) return 'campaignManagement'
  if (/^\/campaigns(\/|$)/.test(normalized) || /^\/participants(\/|$)/.test(normalized)) return 'campaignViewing'
  if (/^\/report-templates\/[^/]+\/(builder|preview)(\/|$)/.test(normalized)) return 'reportTemplateAuthoring'
  if (/^\/report-templates(\/|$)/.test(normalized)) return 'reportTemplateLibrary'
  if (/^\/reports(\/|$)/.test(normalized)) return 'reportViewing'
  if (/^\/integrations(\/|$)/.test(normalized)) return 'integrationManagement'
  if (/^\/clients\/create(\/|$)/.test(normalized)) return 'clientProvisioning'
  if (/^\/clients(\/|$)/.test(normalized)) return 'clientDirectory'
  if (/^\/diagnostics(\/|$)/.test(normalized)) return 'orgDiagnostics'
  if (/^\/(matching|architect)(\/|$)/.test(normalized)) return 'roleMatching'
  if (/^\/business-outcomes\/report(\/|$)/.test(normalized) || (path.startsWith('/client/') && /^\/business-outcomes\/[^/]+$/.test(normalized))) return 'outcomeReports'
  if (/^\/business-outcomes(\/|$)/.test(normalized)) return 'outcomeStudies'
  if (/^\/settings\/users(\/|$)/.test(normalized)) return 'teamManagement'
  if (/^\/chat(\/|$)/.test(normalized)) return 'workspaceAssistant'
  if (/^\/(usage|business\/usage)(\/|$)/.test(normalized)) return 'usageVisibility'
  return null
}
