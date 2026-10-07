import { WorkspaceFeatureUnavailable } from '@/components/workspace-feature-unavailable'
import { isWorkspaceFeatureEnabled } from '@/lib/features/access'
import { PageHeader } from "@/components/page-header";
import { getMatchingRuns } from "@/app/actions/matching";
import { MatchingRunsTable } from "./matching-runs-table";

export default async function MatchingPage() {
  if (!await isWorkspaceFeatureEnabled('roleMatching')) return <WorkspaceFeatureUnavailable feature="roleMatching" />

  const runs = await getMatchingRuns();

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        title="AI Matching Engine"
        description="Use AI to match client diagnostic results with factor frameworks."
      />

      <MatchingRunsTable runs={runs} />
    </div>
  );
}
