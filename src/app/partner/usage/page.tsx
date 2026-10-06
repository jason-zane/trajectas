import { notFound } from "next/navigation";
import {
  canManageClient,
  resolveAuthorizedScope,
} from "@/lib/auth/authorization";
import { PageHeader } from "@/components/page-header";
import { UsagePeriodControls } from "@/components/usage/usage-period-controls";
import { UsageReportPanel } from "@/components/usage/usage-report-panel";
import { resolvePartnerOrg } from "@/lib/auth/resolve-partner-org";
import { getUsageReport } from "@/lib/dal/usage-report";
import {
  resolveUsagePeriod,
  usagePeriodQuery,
  type UsageSearchParams,
} from "@/lib/usage/period";

export default async function PartnerUsagePage({
  searchParams,
}: {
  searchParams: Promise<UsageSearchParams>;
}) {
  const [{ partnerId }, query] = await Promise.all([
    resolvePartnerOrg("/partner/usage"),
    searchParams,
  ]);
  if (!partnerId) notFound();
  const period = resolveUsagePeriod(query);
  const [scope, { report }] = await Promise.all([
    resolveAuthorizedScope(),
    getUsageReport({ kind: "partner", id: partnerId }, period),
  ]);
  const canDrillDown = report.clients.every(
    (client) => !client.clientId || canManageClient(scope, client.clientId),
  );
  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Usage"
        description="Portfolio activity by period, with a breakdown by client."
      />
      <UsagePeriodControls key={usagePeriodQuery(period)} period={period} />
      <UsageReportPanel
        report={report}
        scopeName="Partner workspace"
        defaultGroup="clients"
        clientBasePath={canDrillDown ? "/partner/clients" : undefined}
      />
    </div>
  );
}
