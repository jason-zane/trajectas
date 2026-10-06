import { notFound } from "next/navigation";
import { getPartnerBySlug } from "@/app/actions/partners";
import { UsagePeriodControls } from "@/components/usage/usage-period-controls";
import { UsageReportPanel } from "@/components/usage/usage-report-panel";
import { getUsageReport } from "@/lib/dal/usage-report";
import {
  resolveUsagePeriod,
  usagePeriodQuery,
  type UsageSearchParams,
} from "@/lib/usage/period";

export default async function PartnerUsagePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<UsageSearchParams>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const partner = await getPartnerBySlug(slug);
  if (!partner) notFound();
  const period = resolveUsagePeriod(query);
  const { report } = await getUsageReport(
    { kind: "partner", id: partner.id },
    period,
  );
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-section">Usage</h2>
        <p className="text-caption">
          Portfolio activity by period for {partner.name}.
        </p>
      </div>
      <UsagePeriodControls key={usagePeriodQuery(period)} period={period} />
      <UsageReportPanel
        report={report}
        scopeName={partner.name}
        defaultGroup="clients"
        clientBasePath="/clients"
      />
    </div>
  );
}
