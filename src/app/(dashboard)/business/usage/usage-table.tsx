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
import type { ClientUsageRow } from "@/types/database";

function formatRate(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

export function UsageTable({ rows }: { rows: ClientUsageRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        No clients yet.
      </div>
    );
  }

  const totals = rows.reduce(
    (acc, row) => ({
      invited: acc.invited + row.participantsInvited,
      completed: acc.completed + row.assessmentsCompleted,
    }),
    { invited: 0, completed: 0 },
  );

  return (
    <div className="space-y-2">
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead className="text-right">Campaigns</TableHead>
              <TableHead className="text-right">Invited</TableHead>
              <TableHead className="text-right">Completed</TableHead>
              <TableHead className="text-right">Completion</TableHead>
              <TableHead>Last activity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.clientId}>
                <TableCell className="font-medium">
                  {row.clientName}
                  {!row.isActive ? (
                    <Badge variant="outline" className="ml-2">
                      inactive
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.campaignsActive}/{row.campaignsTotal}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.participantsInvited}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.assessmentsCompleted}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatRate(row.completionRate)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(row.lastActivityAt, "—")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="px-1 text-xs text-muted-foreground">
        {rows.length} client{rows.length === 1 ? "" : "s"} · {totals.invited}{" "}
        invited · {totals.completed} completed across all campaigns
      </p>
    </div>
  );
}
