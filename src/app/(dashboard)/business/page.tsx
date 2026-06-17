import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { requireAdminScope } from "@/lib/auth/authorization";
import { getFinanceOverview } from "@/lib/dal/business-centre";
import { UsageTrendChart } from "@/components/business/usage-trend-chart";

function money(cents: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(cents / 100);
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-caption">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

export default async function BusinessOverviewPage() {
  await requireAdminScope();
  const o = await getFinanceOverview();

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        eyebrow="Business"
        title="Overview"
        description="Revenue, receivables and usage across all clients."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Outstanding (AR)" value={money(o.outstandingCents)} sub="open invoices" />
        <Metric label="Invoiced this month" value={money(o.invoicedThisMonthCents)} />
        <Metric label="Paid this month" value={money(o.paidThisMonthCents)} />
        <Metric
          label="Usage this month"
          value={money(o.usageThisMonthRevenueCents)}
          sub={`${o.usageThisMonthCompleted} completed · ${o.activeUsageClients} on usage billing`}
        />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Invoiced — last 6 months</h3>
        <UsageTrendChart
          data={o.invoicedTrend}
          formatValue={(v) => money(v)}
          emptyLabel="No invoices yet"
        />
      </div>

      <div className="flex gap-4 text-sm">
        <Link href="/business/invoices" className="text-primary hover:underline">
          All invoices →
        </Link>
        <Link href="/business/usage" className="text-primary hover:underline">
          Usage by client →
        </Link>
      </div>
    </div>
  );
}
