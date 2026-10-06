import { WorkspaceFeatureUnavailable } from '@/components/workspace-feature-unavailable'
import { isWorkspaceFeatureEnabled } from '@/lib/features/access'
import { listOutcomeStudies } from "@/lib/dal/outcomes";
import { OutcomeStudyList } from "@/components/outcomes/study-list";
export default async function BusinessOutcomesPage() {
  if (!await isWorkspaceFeatureEnabled('outcomeStudies')) return <WorkspaceFeatureUnavailable feature="outcomeStudies" />

  return <OutcomeStudyList {...await listOutcomeStudies()} />;
}
