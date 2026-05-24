import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LocalTime } from "@/components/local-time";
import { SessionScoresPanel } from "./session-scores-panel";
import { SessionResponsesPanel } from "./session-responses-panel";
import { CampaignSessionReportsPanel } from "./campaign-session-reports-panel";
import {
  SessionStatusBadge,
  SessionProcessingBadge,
} from "./status-badges";
import type { SessionDetail } from "@/app/actions/sessions";
import type { getCampaignSessionReportRows } from "@/app/actions/reports";

type SessionReportRow = Awaited<
  ReturnType<typeof getCampaignSessionReportRows>
>[number];

interface SessionViewProps {
  session: SessionDetail;
  reportRows: SessionReportRow[];
  canSeeResponses: boolean;
  backHref: string;
  backLabel: string;
  reportBasePath: string;
  settingsHref?: string;
}

function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null) return "—";
  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function MetaItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-medium text-foreground tabular-nums">{value}</p>
    </div>
  );
}

export function SessionView({
  session,
  reportRows,
  canSeeResponses,
  backHref,
  backLabel,
  reportBasePath,
  settingsHref,
}: SessionViewProps) {
  const showProcessingBanner =
    session.processingStatus === "scoring" ||
    session.processingStatus === "reporting" ||
    session.processingStatus === "failed";

  const attemptValue =
    session.totalAttempts > 1
      ? `${session.attemptNumber} of ${session.totalAttempts}`
      : "1 of 1";

  return (
    <div className="max-w-6xl space-y-10">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {backLabel}
      </Link>

      <header className="space-y-4">
        <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-[var(--gold,theme(colors.primary.DEFAULT))]">
          {session.assessmentTitle}
        </p>
        <h1 className="font-sans text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-4xl">
          {session.participantName}
        </h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
          <span>{session.participantEmail}</span>
          <span aria-hidden>·</span>
          <span>{session.campaignTitle}</span>
          {session.clientName ? (
            <>
              <span aria-hidden>·</span>
              <span>{session.clientName}</span>
            </>
          ) : null}
          <span aria-hidden className="mx-1 h-3.5 w-px bg-border" />
          <SessionStatusBadge status={session.status} />
          {session.status === "completed" ? (
            <SessionProcessingBadge status={session.processingStatus} />
          ) : null}
        </div>
      </header>

      {showProcessingBanner ? (
        <Card
          className={
            session.processingStatus === "failed"
              ? "border-destructive/30 bg-destructive/5"
              : "border-primary/15 bg-primary/5"
          }
        >
          <CardContent className="py-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <SessionProcessingBadge status={session.processingStatus} />
              <span className="font-medium">
                {session.processingStatus === "scoring"
                  ? "This session is still being scored."
                  : session.processingStatus === "reporting"
                    ? "Scores are ready and report generation is still running."
                    : "This session completed, but downstream processing failed."}
              </span>
            </div>
            {session.processingError ? (
              <p className="mt-2 text-muted-foreground">{session.processingError}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-x-8 gap-y-5 border-y border-border py-5 sm:grid-cols-3 lg:grid-cols-6">
        <MetaItem label="Attempt" value={attemptValue} />
        <MetaItem label="Duration" value={formatDuration(session.durationMinutes)} />
        <MetaItem label="Factors" value={session.scores.length} />
        <MetaItem
          label="Started"
          value={
            session.startedAt ? (
              <LocalTime iso={session.startedAt} format="date-time" />
            ) : (
              "—"
            )
          }
        />
        <MetaItem
          label="Completed"
          value={
            session.completedAt ? (
              <LocalTime iso={session.completedAt} format="date-time" />
            ) : (
              "—"
            )
          }
        />
        <MetaItem
          label="Processed"
          value={
            session.processedAt ? (
              <LocalTime iso={session.processedAt} format="date-time" />
            ) : (
              "—"
            )
          }
        />
      </div>

      <Tabs defaultValue="scores">
        <TabsList>
          <TabsTrigger value="scores">Scores</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          {canSeeResponses ? (
            <TabsTrigger value="responses">Responses</TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="scores" className="mt-6">
          <SessionScoresPanel
            scores={session.scores}
            dimensionScores={session.dimensionScores}
            compositeScore={session.compositeScore}
            sessionStatus={session.status}
            processingStatus={session.processingStatus}
            processingError={session.processingError}
          />
        </TabsContent>

        <TabsContent value="reports" className="mt-6">
          <CampaignSessionReportsPanel
            sessionId={session.id}
            initialRows={reportRows}
            reportBasePath={reportBasePath}
            settingsHref={settingsHref}
          />
        </TabsContent>

        {canSeeResponses ? (
          <TabsContent value="responses" className="mt-6">
            <SessionResponsesPanel sessionId={session.id} />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
