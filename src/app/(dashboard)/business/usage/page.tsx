import { PageHeader } from "@/components/page-header";
import { requireAdminScope } from "@/lib/auth/authorization";
import { getClientUsageSummary } from "@/lib/dal/usage";

import { UsageTable } from "./usage-table";

export default async function UsagePage() {
  await requireAdminScope();
  const rows = await getClientUsageSummary();

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        eyebrow="Business"
        title="Usage"
        description="Actual product usage by client — survey-takers invited and assessments completed."
      />
      <UsageTable rows={rows} />
    </div>
  );
}
