import { isWorkspaceFeatureEnabled } from '@/lib/features/access'
import { WorkspaceFeatureUnavailable } from '@/components/workspace-feature-unavailable'
import { PageHeader } from "@/components/page-header";
import { UsagePeriodControls } from "@/components/usage/usage-period-controls";
import { UsageReportPanel } from "@/components/usage/usage-report-panel";
import { getUsageReport } from "@/lib/dal/usage-report";
import { listClientUsagePricing } from "@/lib/dal/usage-billing";
import {
  resolveUsagePeriod,
  singleParam,
  usagePeriodQuery,
  type UsageSearchParams,
} from "@/lib/usage/period";
import { requireAdminScope } from "@/lib/auth/authorization";

export default async function UsagePage({
  searchParams,
}: {
  searchParams: Promise<UsageSearchParams>;
}) {
  if (!await isWorkspaceFeatureEnabled('usageVisibility')) return <WorkspaceFeatureUnavailable feature="usageVisibility" />

  await requireAdminScope();
  const query = await searchParams;
  const period = resolveUsagePeriod(query);
  const clientId = singleParam(query.client);
  const partnerId = singleParam(query.partner);
  const [{ report, clientOptions, partnerOptions }, pricing] =
    await Promise.all([
      getUsageReport({ kind: "business", clientId, partnerId }, period),
      listClientUsagePricing(),
    ]);
  const scopeName =
    clientOptions.find((client) => client.id === clientId)?.name ??
    partnerOptions.find((partner) => partner.id === partnerId)?.name ??
    "Business usage";
  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        eyebrow="Business"
        title="Usage"
        description="Activity by period across clients and partners. Review usage and export it for reconciliation. Configure rates in each client’s Billing tab."
      />
      <UsagePeriodControls
        key={`${usagePeriodQuery(period)}:${clientId}:${partnerId}`}
        period={period}
        clientOptions={clientOptions}
        partnerOptions={partnerOptions}
        selectedClient={clientId}
        selectedPartner={partnerId}
      />
      <UsageReportPanel
        report={report}
        scopeName={scopeName}
        defaultGroup="clients"
        allowGrouping
        showAdminLinks
        clientBasePath="/clients"
        campaignBasePath="/campaigns"
        pricing={pricing.filter((price) =>
          report.clients.some((client) => client.clientId === price.clientId),
        )}
      />
    </div>
  );
}
