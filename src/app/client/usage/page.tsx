import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { UsagePeriodControls } from "@/components/usage/usage-period-controls";
import { UsageReportPanel } from "@/components/usage/usage-report-panel";
import { resolveClientOrg } from "@/lib/auth/resolve-client-org";
import { getUsageReport } from "@/lib/dal/usage-report";
import {
  resolveUsagePeriod,
  usagePeriodQuery,
  type UsageSearchParams,
} from "@/lib/usage/period";

export default async function ClientUsagePage({
  searchParams,
}: {
  searchParams: Promise<UsageSearchParams>;
}) {
  const [{ clientId }, query] = await Promise.all([
    resolveClientOrg("/client/usage"),
    searchParams,
  ]);
  if (!clientId) notFound();
  const period = resolveUsagePeriod(query);
  const { report } = await getUsageReport(
    { kind: "client", id: clientId },
    period,
  );
  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Usage"
        description="Activity by period across your campaigns."
      />
      <UsagePeriodControls key={usagePeriodQuery(period)} period={period} />
      <UsageReportPanel
        report={report}
        scopeName="Client workspace"
        campaignBasePath="/client/campaigns"
      />
    </div>
  );
}
