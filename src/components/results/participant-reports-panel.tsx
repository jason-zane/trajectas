import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { ExternalLink } from "lucide-react";
import { LocalTime } from "@/components/local-time";
import { ReportPdfButton } from "@/components/reports/report-pdf-button";
import {
  getReportStatusLabel,
  getReportStatusVariant,
  isReportViewable,
} from "@/lib/reports/status";
import type { ReportSnapshot } from "@/types/database";

type SnapshotWithTemplate = ReportSnapshot & { templateName?: string };

interface ParticipantReportsPanelProps {
  snapshots: SnapshotWithTemplate[];
  sessionBaseHref: string;
}

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

export function ParticipantReportsPanel({
  snapshots,
}: ParticipantReportsPanelProps) {
  if (snapshots.length === 0) {
    return (
      <EmptyState
        variant="default"
        title="No reports yet"
        description="Reports will appear here once generated from any session."
      />
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Template</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Generated</TableHead>
            <TableHead className="w-24"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {snapshots.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium">
                {s.templateName ?? "Template"}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={getReportStatusVariant(s.status)}>
                    {getReportStatusLabel(s.status)}
                  </Badge>
                  {s.pdfStatus && (
                    <Badge variant={PDF_STATUS_VARIANT[s.pdfStatus] ?? "outline"}>
                      {pdfStatusLabel(s.pdfStatus)}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                <LocalTime iso={s.generatedAt ?? undefined} format="relative" />
              </TableCell>
              <TableCell>
                {isReportViewable(s.status) && (
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      href={`/reports/${s.id}`}
                      className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      Preview
                      <ExternalLink className="size-3.5" />
                    </Link>
                    <ReportPdfButton
                      snapshotId={s.id}
                      initialPdfUrl={s.pdfUrl}
                      initialPdfStatus={s.pdfStatus}
                      size="sm"
                    />
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
