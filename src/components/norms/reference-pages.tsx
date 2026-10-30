import { listNormReferences, getCampaignReferenceSettings } from '@/lib/dal/norm-references'
import { ReferenceDefaultForm } from './reference-default-form'
import { CampaignReferencePanel } from './campaign-reference-panel'
import { ReportEditions } from './report-editions'
import { getSessionReferenceWorkspace } from '@/app/actions/norm-references'
import { isWorkspaceFeatureEnabled } from '@/lib/features/access'
import { WorkspaceFeatureUnavailable } from '@/components/workspace-feature-unavailable'

export async function AssessmentReferences({ assessmentId }: { assessmentId: string }) {
  if (!await isWorkspaceFeatureEnabled('assessmentAuthoring')) return <WorkspaceFeatureUnavailable feature="assessmentAuthoring" />
  return <ReferenceDefaultForm assessmentId={assessmentId} references={await listNormReferences(assessmentId)} />
}
export async function CampaignReferences({ campaignId }: { campaignId: string }) {
  return <CampaignReferencePanel campaignId={campaignId} settings={await getCampaignReferenceSettings(campaignId)} />
}
export async function SessionReferenceReports({ sessionId, reportBasePath }: { sessionId: string; reportBasePath: string }) {
  if (!await isWorkspaceFeatureEnabled('reportViewing')) return <WorkspaceFeatureUnavailable feature="reportViewing" />
  return <ReportEditions sessionId={sessionId} reportBasePath={reportBasePath} workspace={await getSessionReferenceWorkspace(sessionId)} />
}
