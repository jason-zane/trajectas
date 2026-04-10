"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { RefreshCw, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { getSessionSnapshots, type SessionDetailSnapshot } from "@/app/actions/sessions";
import { releaseSnapshot, retrySnapshot } from "@/app/actions/reports";
import { LocalTime } from "@/components/local-time";

interface SessionReportsPanelProps {
  sessionId: string;
  initialSnapshots: SessionDetailSnapshot[];
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "secondary",
  generating: "secondary",
  ready: "default",
  released: "default",
  failed: "destructive",
};

function statusLabel(s: string): string {
  if (s === "pending") return "Pending";
  if (s === "generating") return "Generating";
  if (s === "ready") return "Ready";
  if (s === "released") return "Released";
  if (s === "failed") return "Failed";
  return s;
}

function audienceLabel(a: string): string {
  if (a === "participant") return "Participant";
  if (a === "hr_manager") return "HR Manager";
  if (a === "consultant") return "Consultant";
  return a;
}

export function SessionReportsPanel({
  sessionId,
  initialSnapshots,
}: SessionReportsPanelProps) {
  const [snapshots, setSnapshots] = useState(initialSnapshots);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const next = await getSessionSnapshots(sessionId);
      setSnapshots(next);
    } catch {
      toast.error("Failed to refresh snapshots");
    } finally {
      setIsRefreshing(false);
    }
  }, [sessionId]);

  useEffect(() => {
    const hasActive = snapshots.some(
      (s) => s.status === "pending" || s.status === "generating"
    );
    if (!hasActive) return;

    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [snapshots, refresh]);

  function handleRelease(id: string) {
    startTransition(async () => {
      try {
        await releaseSnapshot(id);
        toast.success("Report released");
        await refresh();
      } catch {
        toast.error("Failed to release report");
      }
    });
  }

  function handleRetry(id: string) {
    startTransition(async () => {
      try {
        await retrySnapshot(id);
        toast.success("Retrying report generation");
        await refresh();
      } catch {
        toast.error("Failed to retry");
      }
    });
  }

  if (snapshots.length === 0) {
    return (
      <EmptyState
        title="No reports generated yet"
        description="Use the Generate Report button above to create a report for this session."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {snapshots.map((snapshot) => (
        <Card key={snapshot.id}>
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium truncate">
                  {snapshot.templateName ?? "Template"}
                </p>
                <Badge variant="outline" className="text-xs">
                  {audienceLabel(snapshot.audienceType)}
                </Badge>
                <Badge variant={STATUS_VARIANT[snapshot.status] ?? "outline"}>
                  {statusLabel(snapshot.status)}
                </Badge>
              </div>
              <p className="text-caption text-muted-foreground mt-1">
                {snapshot.generatedAt ? (
                  <>
                    Generated <LocalTime iso={snapshot.generatedAt} format="relative" />
                  </>
                ) : (
                  "Queued"
                )}
                {snapshot.errorMessage && (
                  <span className="text-destructive ml-2">
                    · {snapshot.errorMessage}
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {(snapshot.status === "ready" || snapshot.status === "released") && (
                <Link
                  href={`/reports/${snapshot.id}`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  Preview
                  <ExternalLink className="size-3.5" />
                </Link>
              )}
              {snapshot.status === "ready" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRelease(snapshot.id)}
                >
                  Release
                </Button>
              )}
              {snapshot.status === "failed" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRetry(snapshot.id)}
                >
                  Retry
                </Button>
              )}
              {snapshot.pdfUrl && (snapshot.status === "ready" || snapshot.status === "released") && (
                <Link
                  href={`/api/reports/${snapshot.id}/pdf`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:text-primary"
                >
                  PDF
                  <ExternalLink className="size-3.5" />
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
