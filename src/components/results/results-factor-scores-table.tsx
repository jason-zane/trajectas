import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { ReportPdfButton } from "@/components/reports/report-pdf-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LocalTime } from "@/components/local-time";
import type { CampaignFactorScoreRow } from "@/app/actions/campaign-results";

interface ResultsFactorScoresTableProps {
  rows: CampaignFactorScoreRow[];
  sessionHref: (row: CampaignFactorScoreRow) => string;
  reportHref: (snapshotId: string) => string;
}

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  pending: "secondary",
  generating: "secondary",
  ready: "default",
  released: "default",
  failed: "destructive",
};

const PDF_STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  queued: "secondary",
  generating: "secondary",
  ready: "default",
  failed: "destructive",
};

function pdfStatusLabel(status: string): string {
  if (status === "queued") return "PDF queued";
  if (status === "generating") return "PDF generating";
  if (status === "ready") return "PDF ready";
  if (status === "failed") return "PDF failed";
  return status;
}

function bandToneClass(band: CampaignFactorScoreRow["factors"][number]["band"]) {
  if (band === "high") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100";
  }
  if (band === "low") {
    return "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100";
  }
  return "border-border bg-muted text-foreground";
}

export function ResultsFactorScoresTable({
  rows,
  sessionHref,
  reportHref,
}: ResultsFactorScoresTableProps) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No completed scores yet"
        description="Factor scores will appear here once participants finish an assessment and scoring completes."
      />
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Participant</TableHead>
            <TableHead>Assessment</TableHead>
            <TableHead>Completed</TableHead>
            <TableHead>Factor scores</TableHead>
            <TableHead className="w-36">Report</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.sessionId}>
              <TableCell>
                <div className="min-w-0">
                  <Link
                    href={sessionHref(row)}
                    className="font-semibold text-foreground hover:text-primary"
                  >
                    {row.participantName}
                  </Link>
                  <p className="truncate text-caption text-muted-foreground">
                    {row.participantEmail}
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <p className="font-medium">{row.assessmentTitle}</p>
                  <p className="text-caption text-muted-foreground">
                    Attempt #{row.attemptNumber}
                  </p>
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                <LocalTime iso={row.completedAt} format="date-time" />
              </TableCell>
              <TableCell>
                {row.factors.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Scores are still being calculated.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {row.factors.map((factor) => (
                      <div
                        key={`${row.sessionId}-${factor.factorId}`}
                        className={`rounded-full border px-2.5 py-1 text-xs ${bandToneClass(
                          factor.band
                        )}`}
                      >
                        <span className="font-medium">{factor.factorName}</span>{" "}
                        <span className="tabular-nums">{Math.round(factor.scaledScore)}</span>
                        <span className="text-muted-foreground"> · {factor.bandLabel}</span>
                      </div>
                    ))}
                  </div>
                )}
              </TableCell>
              <TableCell>
                <div className="flex flex-col items-start gap-2">
                  {row.reportStatus ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={STATUS_VARIANT[row.reportStatus] ?? "outline"}>
                        {row.reportStatus}
                      </Badge>
                      {row.reportPdfStatus && (
                        <Badge
                          variant={
                            PDF_STATUS_VARIANT[row.reportPdfStatus] ?? "outline"
                          }
                        >
                          {pdfStatusLabel(row.reportPdfStatus)}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Not generated</span>
                  )}
                  {row.reportPdfStatus === "failed" && row.reportPdfErrorMessage && (
                    <p className="text-xs text-destructive">
                      {row.reportPdfErrorMessage}
                    </p>
                  )}
                  {row.reportSnapshotId &&
                    (row.reportStatus === "ready" || row.reportStatus === "released") && (
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <Link
                          href={reportHref(row.reportSnapshotId)}
                          className="font-medium text-primary hover:underline"
                        >
                          Preview
                        </Link>
                        <ReportPdfButton
                          snapshotId={row.reportSnapshotId}
                          initialPdfStatus={row.reportPdfStatus}
                          size="sm"
                        />
                      </div>
                    )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
