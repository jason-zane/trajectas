"use client";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import type { Invoice, UsageSnapshot } from "@/types/database";

function date(value: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}
export function UsageStatements({
  statements,
  invoices,
  currency,
}: {
  statements: UsageSnapshot[];
  invoices: Invoice[];
  currency: string;
}) {
  const money = (cents: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  const columns: ColumnDef<UsageSnapshot>[] = [
    {
      accessorKey: "periodStart",
      header: "Usage period (UTC)",
      cell: ({ row }) =>
        `${date(row.original.periodStart)} – ${date(new Date(new Date(row.original.periodEnd).getTime() - 1).toISOString())}`,
    },
    {
      accessorKey: "quantity",
      header: "Completed journeys",
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.quantity}</span>
      ),
    },
    {
      accessorKey: "unitPriceCents",
      header: "Saved rate",
      cell: ({ row }) => money(row.original.unitPriceCents),
    },
    {
      accessorKey: "amountCents",
      header: "Saved amount",
      cell: ({ row }) => money(row.original.amountCents),
    },
    {
      id: "status",
      header: "Invoice status",
      cell: ({ row }) => {
        const statement = row.original;
        const invoice = invoices.find(
          (item) => item.id === statement.invoiceId,
        );
        const status =
          invoice?.status ??
          (statement.invoiceId
            ? "Invoice linked"
            : statement.quantity === 0
              ? "No usage"
              : "No invoice linked");
        return (
          <Badge
            variant={
              !statement.invoiceId && statement.quantity > 0
                ? "destructive"
                : "outline"
            }
          >
            {status}
          </Badge>
        );
      },
    },
    {
      id: "invoice",
      header: "Invoice",
      cell: ({ row }) => {
        const invoice = invoices.find(
          (item) => item.id === row.original.invoiceId,
        );
        return invoice?.hostedInvoiceUrl ? (
          <a
            href={invoice.hostedInvoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            View invoice
          </a>
        ) : (
          "—"
        );
      },
    },
  ];
  return (
    <div className="space-y-2">
      <h3 className="text-section">Saved usage statements</h3>
      <p className="text-caption">
        Figures frozen by monthly billing, before tax. A saved statement without
        an invoice link has not been confirmed invoiced.
      </p>
      <DataTable
        columns={columns}
        data={statements}
        getRowId={(row) => row.id}
        revealOnScroll={false}
        emptyState={
          <EmptyState
            size="sm"
            title="No saved usage statements"
            description="Live period reporting and CSV export are available above, even when monthly billing is off."
          />
        }
      />
    </div>
  );
}
