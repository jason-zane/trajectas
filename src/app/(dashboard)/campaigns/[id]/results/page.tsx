import Link from "next/link";
import { getCampaignById } from "@/app/actions/campaigns";
import { getReportSnapshotsForCampaign } from "@/app/actions/reports";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReleaseSnapshotButton } from "@/app/(dashboard)/reports/[snapshotId]/release-snapshot-button";
import { RetryButton } from "./retry-button";
import type { ReportSnapshot } from "@/types/database";

const audienceLabel: Record<string, string> = {
  participant: "Participant",
  hr_manager: "HR Manager",
  consultant: "Consultant",
};

const statusLabel: Record<string, string> = {
  pending: "Pending",
  generating: "Generating",
  ready: "Ready",
  released: "Released",
  failed: "Failed",
};

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default async function CampaignResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [campaign, snapshots] = await Promise.all([
    getCampaignById(id),
    getReportSnapshotsForCampaign(id),
  ]);
  if (!campaign) notFound();

  const total = campaign.participants.length;
  const byStatus = campaign.participants.reduce<Record<string, number>>(
    (acc, c) => {
      acc[c.status] = (acc[c.status] ?? 0) + 1;
      return acc;
    },
    {},
  );

  const funnelSteps = [
    { label: "Invited", count: total, color: "bg-muted-foreground" },
    {
      label: "Started",
      count: (byStatus["in_progress"] ?? 0) + (byStatus["completed"] ?? 0),
      color: "bg-blue-500",
    },
    {
      label: "Completed",
      count: byStatus["completed"] ?? 0,
      color: "bg-primary",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Completion funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Completion Funnel
          </CardTitle>
        </CardHeader>
        <CardContent>
          {total === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No participants invited yet.
            </p>
          ) : (
            <div className="space-y-3">
              {funnelSteps.map((step) => {
                const pct = total > 0 ? (step.count / total) * 100 : 0;
                return (
                  <div key={step.label}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>{step.label}</span>
                      <span className="text-muted-foreground">
                        {step.count} ({Math.round(pct)}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${step.color} transition-all`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-assessment breakdown */}
      {campaign.assessments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Per-Assessment Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {campaign.assessments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium">{a.assessmentTitle}</p>
                    <Badge
                      variant="outline"
                      className="text-[10px] mt-0.5"
                    >
                      {a.assessmentStatus}
                    </Badge>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    {a.isRequired ? "Required" : "Optional"}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Report Snapshots */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Report Snapshots
          </CardTitle>
        </CardHeader>
        <CardContent className={snapshots.length > 0 ? "p-0" : undefined}>
          {snapshots.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No reports generated yet. Ensure campaign report templates are
              configured in Settings.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {snapshots.map((snapshot: ReportSnapshot) => (
                <div
                  key={snapshot.id}
                  className="flex flex-wrap items-center gap-3 px-6 py-3"
                >
                  <div className="flex flex-1 flex-wrap items-center gap-3 min-w-0">
                    <span className="font-mono text-xs text-muted-foreground">
                      {snapshot.participantSessionId.slice(0, 8)}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {audienceLabel[snapshot.audienceType] ?? snapshot.audienceType}
                    </Badge>
                    <Badge
                      variant={
                        snapshot.status === "failed" ? "destructive" : "secondary"
                      }
                      className={`text-xs ${
                        snapshot.status === "released"
                          ? "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30"
                          : snapshot.status === "ready"
                            ? "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30"
                            : ""
                      }`}
                    >
                      {statusLabel[snapshot.status] ?? snapshot.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {relativeTime(snapshot.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      render={<Link href={`/reports/${snapshot.id}`} />}
                    >
                      Preview
                    </Button>
                    {snapshot.status === "ready" && (
                      <ReleaseSnapshotButton snapshotId={snapshot.id} />
                    )}
                    {snapshot.status === "failed" && (
                      <RetryButton snapshotId={snapshot.id} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
