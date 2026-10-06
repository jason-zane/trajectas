import { WorkspaceFeatureUnavailable } from '@/components/workspace-feature-unavailable'
import { isWorkspaceFeatureEnabled } from '@/lib/features/access'
import { getOutcomeWorkspace } from "@/lib/dal/outcomes";
import { OutcomeWorkspace } from "@/components/outcomes/workspace";
export const maxDuration = 300;
export default async function OutcomeStudyPage({
  params,
}: {
  params: Promise<{ studyId: string }>;
}) {
  if (!await isWorkspaceFeatureEnabled('outcomeStudies')) return <WorkspaceFeatureUnavailable feature="outcomeStudies" />

  const { studyId } = await params;
  return <OutcomeWorkspace {...await getOutcomeWorkspace(studyId)} />;
}
