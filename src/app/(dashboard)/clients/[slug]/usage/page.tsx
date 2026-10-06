import { notFound } from "next/navigation";
import { getClientBySlug } from "@/app/actions/clients";
import { UsagePeriodControls } from "@/components/usage/usage-period-controls";
import { UsageReportPanel } from "@/components/usage/usage-report-panel";
import { getUsageReport } from "@/lib/dal/usage-report";
import {
  resolveUsagePeriod,
  usagePeriodQuery,
  type UsageSearchParams,
} from "@/lib/usage/period";

export default async function ClientUsagePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<UsageSearchParams>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const client = await getClientBySlug(slug);
  if (!client) notFound();
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
        campaignBasePath="/campaigns"
      />
    </div>
  );
}
