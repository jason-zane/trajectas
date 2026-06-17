import { PageHeader } from "@/components/page-header";
import { requireAdminScope } from "@/lib/auth/authorization";
import { getClientUsageSummary } from "@/lib/dal/usage";
import { listClientUsagePricing } from "@/lib/dal/usage-billing";

import { UsageTable } from "./usage-table";

export default async function UsagePage() {
  await requireAdminScope();
  const [rows, pricing] = await Promise.all([
    getClientUsageSummary(),
    listClientUsagePricing(),
  ]);

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        eyebrow="Business"
        title="Usage"
        description="Actual product usage by client, and per-client usage billing. Enabled clients are invoiced monthly for assessments completed."
      />
      <UsageTable rows={rows} pricing={pricing} />
    </div>
  );
}
