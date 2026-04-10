import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LocalTime } from "@/components/local-time";
import { SessionScoresPanel } from "./session-scores-panel";
import { SessionResponsesPanel } from "./session-responses-panel";
import { SessionReportsPanel } from "./session-reports-panel";
import { GenerateReportTrigger } from "./generate-report-trigger";
import type { SessionDetail } from "@/app/actions/sessions";
import type { GenerateReportDialogTemplate } from "./generate-report-dialog";

interface SessionDetailViewProps {
  session: SessionDetail;
  templates: GenerateReportDialogTemplate[];
  canSeeResponses: boolean;
  backHref: string;
  backLabel: string;
}

function statusBadgeVariant(
  status: string
): "default" | "secondary" | "outline" | "destructive" {
  if (status === "completed") return "default";
  if (status === "in_progress") return "secondary";
  if (status === "expired") return "destructive";
  return "outline";
}

export function SessionDetailView({
  session,
  templates,
  canSeeResponses,
  backHref,
  backLabel,
}: SessionDetailViewProps) {
  const durationLabel =
    session.durationMinutes != null
      ? session.durationMinutes < 60
        ? `${session.durationMinutes}m`
        : `${Math.floor(session.durationMinutes / 60)}h ${session.durationMinutes % 60}m`
      : "—";

  return (
    <div className="space-y-6 max-w-6xl">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        {backLabel}
      </Link>

      <PageHeader
        eyebrow={session.assessmentTitle}
        title={session.participantName}
        description={`${session.participantEmail} · ${session.campaignTitle}${
          session.clientName ? ` · ${session.clientName}` : ""
        }`}
      >
        <GenerateReportTrigger
          sessionId={session.id}
          templates={templates}
        />
      </PageHeader>

      {/* Stats strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="py-5">
            <p className="text-caption text-muted-foreground">Status</p>
            <div className="mt-2">
              <Badge variant={statusBadgeVariant(session.status)}>
                {session.status}
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <p className="text-caption text-muted-foreground">Duration</p>
            <p className="text-2xl font-bold tabular-nums mt-1">{durationLabel}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <p className="text-caption text-muted-foreground">Factors scored</p>
            <p className="text-2xl font-bold tabular-nums mt-1">
              {session.scores.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <p className="text-caption text-muted-foreground">
              {session.totalAttempts > 1 ? "Attempt" : "Responses"}
            </p>
            <p className="text-2xl font-bold tabular-nums mt-1">
              {session.totalAttempts > 1
                ? `${session.attemptNumber}/${session.totalAttempts}`
                : session.responseCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Metadata row */}
      <div className="grid gap-2 sm:grid-cols-2 text-sm text-muted-foreground">
        <p>
          Started: <LocalTime iso={session.startedAt} format="date-time" />
        </p>
        <p>
          Completed: <LocalTime iso={session.completedAt} format="date-time" />
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="scores">
        <TabsList>
          <TabsTrigger value="scores">Scores</TabsTrigger>
          {canSeeResponses && <TabsTrigger value="responses">Responses</TabsTrigger>}
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="scores" className="mt-4">
          <SessionScoresPanel scores={session.scores} />
        </TabsContent>

        {canSeeResponses && (
          <TabsContent value="responses" className="mt-4">
            <SessionResponsesPanel sessionId={session.id} />
          </TabsContent>
        )}

        <TabsContent value="reports" className="mt-4">
          <SessionReportsPanel
            sessionId={session.id}
            initialSnapshots={session.snapshots}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
