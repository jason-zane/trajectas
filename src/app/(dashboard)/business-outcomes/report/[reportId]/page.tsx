import { WorkspaceFeatureUnavailable } from '@/components/workspace-feature-unavailable'
import { isWorkspaceFeatureEnabled } from '@/lib/features/access'
import { getOutcomeReport } from "@/lib/dal/outcomes";
import { buildSurfaceUrl } from "@/lib/hosts";
import { PublishedOutcomeReport } from "@/components/outcomes/published-report";
export default async function ReportPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  if (!await isWorkspaceFeatureEnabled('outcomeReports')) return <WorkspaceFeatureUnavailable feature="outcomeReports" />

  const { reportId } = await params,
    report = await getOutcomeReport(reportId);
  return (
    <PublishedOutcomeReport
      report={report}
      clientUrl={
        buildSurfaceUrl(
          "client",
          `/business-outcomes/${reportId}`,
        )?.toString() ?? `/client/business-outcomes/${reportId}`
      }
    />
  );
}
