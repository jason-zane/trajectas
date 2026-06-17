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
import { UsageTrendChart } from "@/components/business/usage-trend-chart";
import { CreateInvoiceDialog } from "@/app/(dashboard)/business/invoices/create-invoice-dialog";
import { ConfigureUsageBillingButton } from "@/app/(dashboard)/business/usage/configure-usage-dialog";
import type { ClientBillingHub } from "@/lib/dal/business-centre";
import type { Client, InvoiceStatus } from "@/types/database";

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
}: {
  client: Client;
  hub: ClientBillingHub;
}) {
  const ba = hub.billingAccount;
  const currency = ba?.currency ?? "aud";
  const outstanding = hub.invoices
    .filter((i) => i.status === "open" || i.status === "uncollectible")
    .reduce((sum, i) => sum + i.amountDueCents, 0);

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
          <p className="mt-1 text-xs text-muted-foreground">across open invoices</p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-caption">Usage billing</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {ba?.usageBillingEnabled ? money(ba.usageUnitPriceCents, currency) : "Off"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {ba?.usageBillingEnabled ? "per completed assessment" : "not enabled"}
          </p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-caption">Assessments completed</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {hub.usageTotals.completed}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {hub.usageTotals.invited} invited (all time)
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">
          Assessments completed — last 12 months
        </h3>
        <UsageTrendChart
          data={hub.usageMonthly}
          emptyLabel="No completed assessments yet"
        />
      </div>

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
                      <Badge variant={STATUS_VARIANT[inv.status]}>{inv.status}</Badge>
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
