"use client";

import Link from "next/link";
import { toast } from "sonner";
import { authorizeWorkspaceUsageExport } from "@/app/actions/workspace-features";
import { WorkspaceFeatureVisibility } from "@/components/workspace-feature-visibility";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { DataTable, DataTableColumnHeader } from "@/components/data-table";
import { usagePeriodQuery } from "@/lib/usage/period";
import {
  usageReportCsv,
  type UsageBreakdown,
  type UsageGroup,
  type UsageReport,
} from "@/lib/usage/report";

const EMPTY_PRICING: {
  clientId: string;
  enabled: boolean;
  unitPriceCents: number;
}[] = [];

const SEARCH_COLUMNS: (keyof UsageBreakdown)[] = ["name", "partnerName"];
const GROUP_LABEL: Record<UsageGroup, string> = {
  campaigns: "Campaign",
  clients: "Client",
  partners: "Partner",
};

export function UsageReportPanel({
  report,
  scopeName,
  defaultGroup = "campaigns",
  allowGrouping = false,
  clientBasePath,
  campaignBasePath,
  showAdminLinks = false,
  pricing = EMPTY_PRICING,
}: {
  report: UsageReport;
  scopeName: string;
  defaultGroup?: UsageGroup;
  allowGrouping?: boolean;
  clientBasePath?: string;
  campaignBasePath?: string;
  showAdminLinks?: boolean;
  pricing?: { clientId: string; enabled: boolean; unitPriceCents: number }[];
}) {
  const [group, setGroup] = useState<UsageGroup>(defaultGroup);
  const rows = report[group];
  const query = usagePeriodQuery(report.period);
  const columns = useMemo<ColumnDef<UsageBreakdown>[]>(() => {
    const counts = (["added", "started", "completed"] as const).map((key) => ({
      accessorKey: key,
      header: ({
        column,
      }: {
        column: import("@tanstack/react-table").Column<UsageBreakdown, unknown>;
      }) => (
        <DataTableColumnHeader
          column={column}
          title={
            key === "added"
              ? "Added"
              : key === "started"
                ? "Started"
                : "Completed journeys"
          }
        />
      ),
      cell: ({
        row,
      }: {
        row: import("@tanstack/react-table").Row<UsageBreakdown>;
      }) => (
        <span className="tabular-nums">
          {row.original[key].toLocaleString("en-AU")}
        </span>
      ),
    }));
    const name: ColumnDef<UsageBreakdown> = {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={GROUP_LABEL[group]} />
      ),
      cell: ({ row }) => {
        const item = row.original;
        let href: string | undefined;
        if (group === "clients" && item.slug && clientBasePath)
          href = `${clientBasePath}/${item.slug}/usage?${query}`;
        if (group === "partners" && item.slug && showAdminLinks)
          href = `/partners/${item.slug}/usage?${query}`;
        if (group === "campaigns" && campaignBasePath)
          href = `${campaignBasePath}/${item.id}/overview`;
        return href ? (
          <Link
            href={href}
            className="font-medium text-primary hover:underline"
          >
            {item.name}
          </Link>
        ) : (
          <span className="font-medium">{item.name}</span>
        );
      },
    };
    const result: ColumnDef<UsageBreakdown>[] = [name];
    if (group === "clients")
      result.push({ accessorKey: "partnerName", header: "Partner" });
    result.push(...counts);
    if (pricing.length && group === "clients")
      result.push({
        id: "rate",
        header: "Current usage rate",
        enableSorting: false,
        cell: ({ row }) => {
          const price = pricing.find(
            (item) => item.clientId === row.original.clientId,
          );
          return (
            <span className="text-muted-foreground">
              {price?.enabled
                ? `${new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(price.unitPriceCents / 100)} / journey`
                : "Off"}
            </span>
          );
        },
      });
    return result;
  }, [group, query, clientBasePath, campaignBasePath, showAdminLinks, pricing]);

  async function exportCsv() {
    try {
      const result = await authorizeWorkspaceUsageExport();
      if ('error' in result) { toast.error(result.error); return; }
    } catch { toast.error('Unable to authorise export.'); return; }
    const blob = new Blob(
      ["\uFEFF", usageReportCsv(report, group, scopeName)],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `usage-${group}-${report.period.from || "all-time"}-${report.period.to || "to-date"}.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const max = Math.max(1, ...report.trend.map((point) => point.value));
  const labelEvery = Math.max(1, Math.ceil(report.trend.length / 8));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge variant="outline">Live activity</Badge>
        <WorkspaceFeatureVisibility features={["usageVisibility"]}><Button variant="outline" onClick={exportCsv}>
          <Download className="size-4" />
          Export CSV
        </Button></WorkspaceFeatureVisibility>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {(
          [
            [
              "Participants added",
              report.totals.added,
              "Invitations and self-registrations by date added",
            ],
            [
              "Participants started",
              report.totals.started,
              "By the date they first started",
            ],
            [
              "Completed journeys",
              report.totals.completed,
              "One participant finishing all assessments in a campaign",
            ],
          ] as const
        ).map(([label, count, detail]) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <p className="text-caption">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {count.toLocaleString("en-AU")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
          </div>
        ))}
      </div>
      <p className="text-caption">
        Each total uses its own event date in the selected period. Participants
        may be added in one month and finish in another. 360 raters and deleted
        records are excluded. These totals do not reset assessment quotas.
      </p>
      <div className="space-y-2">
        <h3 className="text-section">Completed journeys over time</h3>
        {!report.totals.completed ? (
          <EmptyState
            size="sm"
            title="No completions in this period"
            description="Choose another period to review earlier activity."
          />
        ) : (
          <div className="rounded-xl border bg-card p-4">
            <div className="flex h-32 items-end gap-1" aria-hidden="true">
              {report.trend.map((point) => (
                <div
                  key={point.key}
                  title={`${point.label}: ${point.value}`}
                  className="flex h-full min-w-0 flex-1 flex-col justify-end"
                >
                  <div
                    className="w-full rounded-t bg-primary"
                    style={{
                      height: `${(point.value / max) * 100}%`,
                      minHeight: point.value ? 3 : 0,
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-1" aria-hidden="true">
              {report.trend.map((point, index) => (
                <div
                  key={point.key}
                  className="min-w-0 flex-1 whitespace-nowrap text-[10px] text-muted-foreground"
                >
                  {index % labelEvery === 0 ? point.label : ""}
                </div>
              ))}
            </div>
            <table className="sr-only">
              <caption>
                Completed participant journeys by {report.trendInterval}, UTC
              </caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Completed journeys</th>
                </tr>
              </thead>
              <tbody>
                {report.trend.map((point) => (
                  <tr key={point.key}>
                    <th scope="row">{point.key}</th>
                    <td>{point.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-section">
            Usage by {GROUP_LABEL[group].toLowerCase()}
          </h3>
          {allowGrouping ? (
            <div className="flex items-center gap-2">
              <Label htmlFor="usage-group">Group by</Label>
              <select
                id="usage-group"
                value={group}
                onChange={(event) => setGroup(event.target.value as UsageGroup)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="clients">Client</option>
                <option value="partners">Partner</option>
                <option value="campaigns">Campaign</option>
              </select>
            </div>
          ) : null}
        </div>
        <DataTable
          key={`${group}:${query}`}
          columns={columns}
          data={rows}
          searchableColumns={SEARCH_COLUMNS}
          searchPlaceholder={`Search ${GROUP_LABEL[group].toLowerCase()}s…`}
          defaultSort={{ id: "completed", desc: true }}
          getRowId={(row) => row.id}
          revealOnScroll={false}
          emptyState={
            <EmptyState
              size="sm"
              title={`No ${GROUP_LABEL[group].toLowerCase()}s to report`}
              description="Activity will appear here when campaigns are available in this workspace."
            />
          }
        />
        <p className="text-caption">
          CSV exports include every row in the selected period and account
          filters. Table search only filters the displayed rows.
        </p>
      </div>
      {defaultGroup !== "campaigns" ? (
        <p className="text-caption">
          Partner totals use each client’s current partner. Partner-owned
          campaigns are shown separately in the client breakdown. This
          operational report is not a historical billing statement.
        </p>
      ) : null}
    </div>
  );
}
