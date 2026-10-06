import { ExternalLink } from "lucide-react";

import { formatDate } from "@/lib/formatting";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UsagePeriodControls } from "@/components/usage/usage-period-controls";
import { UsageReportPanel } from "@/components/usage/usage-report-panel";
import { UsageStatements } from "@/components/usage/usage-statements";
import { usagePeriodQuery } from "@/lib/usage/period";
import type { UsageReport } from "@/lib/usage/report";
import { CreateInvoiceDialog } from "@/app/(dashboard)/business/invoices/create-invoice-dialog";
import { ConfigureUsageBillingButton } from "@/app/(dashboard)/business/usage/configure-usage-dialog";
import type { ClientBillingHub } from "@/lib/dal/business-centre";
import type { Client, InvoiceStatus, UsageSnapshot } from "@/types/database";

const STATUS_VARIANT: Record<
  InvoiceStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  draft: "outline",
  open: "secondary",
  paid: "default",
  void: "destructive",
  uncollectible: "destructive",
};

const KIND_LABEL: Record<string, string> = {
  one_off: "One-off",
  usage: "Usage",
  subscription: "Subscription",
};

function money(cents: number, currency = "aud"): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export function ClientBillingPanel({
  client,
  hub,
  report,
  statements,
}: {
  client: Client;
  hub: ClientBillingHub;
  report: UsageReport;
  statements: UsageSnapshot[];
}) {
  const ba = hub.billingAccount;
  const currency = ba?.currency ?? "aud";
  const outstanding = hub.invoices
    .filter((i) => i.status === "open" || i.status === "uncollectible")
    .reduce((sum, i) => sum + i.amountDueCents, 0);

  const savedStatement = statements.find(
    (statement) =>
      report.period.start &&
      report.period.end &&
      new Date(statement.periodStart).getTime() ===
        new Date(report.period.start).getTime() &&
      new Date(statement.periodEnd).getTime() ===
        new Date(report.period.end).getTime(),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-section">Billing &amp; usage</h2>
          <p className="text-caption mt-0.5">
            Invoices, usage and billing settings for {client.name}.
          </p>
        </div>
        <div className="flex gap-2">
          <ConfigureUsageBillingButton
            clientId={client.id}
            clientName={client.name}
            enabled={ba?.usageBillingEnabled ?? false}
            unitPriceCents={ba?.usageUnitPriceCents ?? 0}
          />
          <CreateInvoiceDialog
            clients={[{ id: client.id, name: client.name }]}
            defaultClientId={client.id}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border p-4">
          <p className="text-caption">Outstanding</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {money(outstanding, currency)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            across open invoices
          </p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-caption">Usage billing</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {ba?.usageBillingEnabled
              ? money(ba.usageUnitPriceCents, currency)
              : "Off"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {ba?.usageBillingEnabled
              ? "per completed participant journey"
              : "not enabled"}
          </p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-caption">Lifetime completed journeys</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {hub.usageTotals.completed}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {hub.usageTotals.invited} participants (all time)
          </p>
        </div>
      </div>

      <section className="space-y-5">
        <div>
          <h3 className="text-section">Usage for a period</h3>
          <p className="text-caption">
            Review completed activity and export it for billing reconciliation.
          </p>
        </div>
        <UsagePeriodControls
          key={usagePeriodQuery(report.period)}
          period={report.period}
        />
        {savedStatement ? (
          <div className="rounded-xl border bg-card p-4">
            <p className="text-caption">Saved statement for this period</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {money(savedStatement.amountCents, currency)}
            </p>
            <p className="text-caption">
              {savedStatement.quantity} completed journeys at{" "}
              {money(savedStatement.unitPriceCents, currency)} each, before tax.{" "}
              {savedStatement.invoiceId
                ? "Invoice linked."
                : savedStatement.quantity === 0
                  ? "No usage to invoice."
                  : "No invoice linked — needs reconciliation."}
            </p>
          </div>
        ) : ba?.usageBillingEnabled && report.period.start ? (
          <div className="rounded-xl border bg-card p-4">
            <p className="text-caption">Live estimate at the current rate</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {money(
                report.totals.completed * ba.usageUnitPriceCents,
                currency,
              )}
            </p>
            <p className="text-caption">
              Before tax. Historical rate changes are not reflected; use a saved
              statement for the billed figure.
            </p>
          </div>
        ) : null}
        <UsageReportPanel
          report={report}
          scopeName={client.name}
          campaignBasePath="/campaigns"
        />
      </section>

      <UsageStatements
        statements={statements}
        invoices={hub.invoices}
        currency={currency}
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Invoices</h3>
          {ba?.billingEmail ? (
            <span className="text-xs text-muted-foreground">
              Sent to {ba.billingEmail}
            </span>
          ) : null}
        </div>
        {hub.invoices.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No invoices yet. Use “New invoice” to bill this client.
          </div>
        ) : (
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Invoice</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hub.invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="text-muted-foreground">
                      {inv.number ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {KIND_LABEL[inv.kind] ?? inv.kind}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[inv.status]}>
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(inv.totalCents, inv.currency)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(inv.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      {inv.hostedInvoiceUrl ? (
                        <a
                          href={inv.hostedInvoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          View
                          <ExternalLink className="size-3.5" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
