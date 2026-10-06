import { requirePartnerClient } from "@/lib/auth/resolve-partner-client";
import { UsagePeriodControls } from "@/components/usage/usage-period-controls";
import { UsageReportPanel } from "@/components/usage/usage-report-panel";
import { getUsageReport } from "@/lib/dal/usage-report";
import {
  resolveUsagePeriod,
  usagePeriodQuery,
  type UsageSearchParams,
} from "@/lib/usage/period";

export default async function PartnerClientUsagePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<UsageSearchParams>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const { client } = await requirePartnerClient(slug);
  const period = resolveUsagePeriod(query);
  const { report } = await getUsageReport(
    { kind: "client", id: client.id },
    period,
  );
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-section">Usage</h2>
        <p className="text-caption">Activity by period for {client.name}.</p>
      </div>
      <UsagePeriodControls key={usagePeriodQuery(period)} period={period} />
      <UsageReportPanel
        report={report}
        scopeName={client.name}
        campaignBasePath="/partner/campaigns"
      />
    </div>
  );
}
