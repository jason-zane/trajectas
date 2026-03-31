import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Clock,
  CheckCircle2,
  Mail,
  Megaphone,
  Building2,
  BarChart3,
  FileText,
  Activity,
  LayoutGrid,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { ScrollReveal } from "@/components/scroll-reveal";
import {
  getParticipant,
  getParticipantSessions,
  getParticipantActivity,
  getParticipantResponses,
} from "@/app/actions/participants";

const statusVariant: Record<
  string,
  "secondary" | "default" | "outline" | "destructive"
> = {
  invited: "secondary",
  registered: "outline",
  in_progress: "default",
  completed: "default",
  withdrawn: "destructive",
  expired: "outline",
};

const statusLabel: Record<string, string> = {
  invited: "Invited",
  registered: "Registered",
  in_progress: "In Progress",
  completed: "Completed",
  withdrawn: "Withdrawn",
  expired: "Expired",
};

function formatDate(dateStr?: string) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-AU", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(startStr?: string, endStr?: string) {
  if (!startStr || !endStr) return null;
  const ms = new Date(endStr).getTime() - new Date(startStr).getTime();
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

const activityIcons: Record<string, typeof Calendar> = {
  invited: Mail,
  registered: CheckCircle2,
  started: Activity,
  session_started: Clock,
  session_completed: CheckCircle2,
  completed: CheckCircle2,
};

export default async function ParticipantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const participant = await getParticipant(id);
  if (!participant) notFound();

  const [sessions, activity] = await Promise.all([
    getParticipantSessions(id),
    getParticipantActivity(id),
  ]);

  const displayName =
    participant.firstName || participant.lastName
      ? `${participant.firstName ?? ""} ${participant.lastName ?? ""}`.trim()
      : participant.email;

  const completedSessions = sessions.filter((s) => s.status === "completed");
  const totalDuration = formatDuration(
    participant.startedAt,
    participant.completedAt,
  );

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Back link */}
      <Link
        href="/participants"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        All Participants
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
          {(participant.firstName?.[0] ?? participant.email[0]).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <PageHeader eyebrow="Participant" title={displayName}>
            <Badge
              variant={statusVariant[participant.status] ?? "secondary"}
              className="text-xs"
            >
              {statusLabel[participant.status] ?? participant.status}
            </Badge>
          </PageHeader>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Mail className="size-3.5" />
              {participant.email}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Megaphone className="size-3.5" />
              <Link
                href={`/campaigns/${participant.campaignId}/overview`}
                className="hover:text-foreground transition-colors underline-offset-2 hover:underline"
              >
                {participant.campaignTitle}
              </Link>
            </span>
            {participant.organizationName && (
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="size-3.5" />
                {participant.organizationName}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">
            <LayoutGrid className="size-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Activity className="size-3.5" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="scores">
            <BarChart3 className="size-3.5" />
            Scores
          </TabsTrigger>
          <TabsTrigger value="responses">
            <FileText className="size-3.5" />
            Responses
          </TabsTrigger>
        </TabsList>

        {/* --- OVERVIEW TAB --- */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* Stats cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <ScrollReveal delay={0}>
              <Card>
                <CardContent className="pt-5">
                  <p className="text-caption mb-1">Assessments</p>
                  <p className="text-2xl font-semibold tabular-nums">
                    {completedSessions.length}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      / {sessions.length}
                    </span>
                  </p>
                </CardContent>
              </Card>
            </ScrollReveal>
            <ScrollReveal delay={60}>
              <Card>
                <CardContent className="pt-5">
                  <p className="text-caption mb-1">Total Time</p>
                  <p className="text-2xl font-semibold tabular-nums">
                    {totalDuration ?? "—"}
                  </p>
                </CardContent>
              </Card>
            </ScrollReveal>
            <ScrollReveal delay={120}>
              <Card>
                <CardContent className="pt-5">
                  <p className="text-caption mb-1">Invited</p>
                  <p className="text-2xl font-semibold tabular-nums">
                    {formatDate(participant.invitedAt).split(",")[0]}
                  </p>
                </CardContent>
              </Card>
            </ScrollReveal>
          </div>

          {/* Sessions list */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Assessment Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No sessions started yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {sessions.map((s, i) => (
                    <ScrollReveal key={s.id} delay={i * 60}>
                      <div className="flex items-center gap-3 rounded-lg border p-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <CheckCircle2
                            className={`size-4 ${
                              s.status === "completed"
                                ? "text-primary"
                                : "text-muted-foreground"
                            }`}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold">
                            {s.assessmentTitle}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {s.status === "completed"
                              ? `Completed ${formatDate(s.completedAt)}`
                              : s.status === "in_progress"
                                ? `Started ${formatDate(s.startedAt)}`
                                : "Not started"}
                          </p>
                        </div>
                        <Badge
                          variant={
                            s.status === "completed" ? "default" : "secondary"
                          }
                          className="text-[10px]"
                        >
                          {s.status === "in_progress"
                            ? "In Progress"
                            : s.status.charAt(0).toUpperCase() +
                              s.status.slice(1)}
                        </Badge>
                        {s.scores.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {s.scores.length} score
                            {s.scores.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </ScrollReveal>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- ACTIVITY TAB --- */}
        <TabsContent value="activity" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {activity.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No activity recorded.
                </p>
              ) : (
                <div className="relative ml-4">
                  {/* Timeline line */}
                  <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />

                  <div className="space-y-6">
                    {activity.map((event, i) => {
                      const Icon = activityIcons[event.type] ?? Clock;
                      const isComplete =
                        event.type === "completed" ||
                        event.type === "session_completed";

                      return (
                        <ScrollReveal key={i} delay={i * 80}>
                          <div className="relative flex items-start gap-4 pl-2">
                            <div
                              className={`relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full ${
                                isComplete
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              <Icon className="size-3" />
                            </div>
                            <div className="flex-1 pt-0.5">
                              <p className="text-sm font-medium">
                                {event.label}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(event.timestamp)}
                                {event.detail && ` · ${event.detail}`}
                              </p>
                            </div>
                          </div>
                        </ScrollReveal>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- SCORES TAB --- */}
        <TabsContent value="scores" className="space-y-6 mt-6">
          {sessions.filter((s) => s.scores.length > 0).length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No scores available yet. Scores are computed after an assessment
                is submitted.
              </CardContent>
            </Card>
          ) : (
            sessions
              .filter((s) => s.scores.length > 0)
              .map((session, si) => (
                <ScrollReveal key={session.id} delay={si * 80}>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">
                        {session.assessmentTitle}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {session.scores.map((score) => (
                          <div
                            key={score.factorId}
                            className="flex items-center gap-4"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">
                                {score.factorName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {score.itemsUsed} items ·{" "}
                                {score.scoringMethod.toUpperCase()}
                              </p>
                            </div>
                            {/* Score bar */}
                            <div className="w-48 hidden sm:block">
                              <div className="h-2 w-full rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-primary transition-all"
                                  style={{
                                    width: `${Math.min(100, Math.max(0, score.scaledScore))}%`,
                                  }}
                                />
                              </div>
                            </div>
                            <div className="w-16 text-right">
                              <span className="text-sm font-semibold tabular-nums">
                                {Math.round(score.scaledScore)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                /100
                              </span>
                            </div>
                            {score.percentile != null && (
                              <div className="w-16 text-right">
                                <span className="text-xs text-muted-foreground">
                                  P{Math.round(score.percentile)}
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </ScrollReveal>
              ))
          )}
        </TabsContent>

        {/* --- RESPONSES TAB --- */}
        <TabsContent value="responses" className="space-y-6 mt-6">
          {sessions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No responses available.
              </CardContent>
            </Card>
          ) : (
            <ResponsesPanel sessions={sessions} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Separate async component for responses (loaded on-demand via tab)
async function ResponsesPanel({
  sessions,
}: {
  sessions: {
    id: string;
    assessmentTitle: string;
    status: string;
  }[];
}) {
  const allResponses = await Promise.all(
    sessions
      .filter((s) => s.status === "completed" || s.status === "in_progress")
      .map(async (s) => ({
        sessionId: s.id,
        assessmentTitle: s.assessmentTitle,
        groups: await getParticipantResponses(s.id),
      })),
  );

  if (allResponses.every((r) => r.groups.length === 0)) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No responses recorded yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {allResponses.map((resp) =>
        resp.groups.map((group, gi) => (
          <ScrollReveal key={`${resp.sessionId}-${group.sectionId}`} delay={gi * 60}>
            <Card>
              <CardHeader>
                <div>
                  <p className="text-overline text-primary">
                    {resp.assessmentTitle}
                  </p>
                  <CardTitle className="text-sm">{group.sectionTitle}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {group.items.map((item) => (
                    <div
                      key={item.itemId}
                      className="flex items-center gap-3 rounded-md border px-3 py-2"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm line-clamp-2">{item.stem}</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-3">
                        <span className="text-sm font-semibold tabular-nums w-8 text-center">
                          {item.responseValue}
                        </span>
                        {item.responseTimeMs != null && (
                          <span className="text-xs text-muted-foreground w-14 text-right">
                            {(item.responseTimeMs / 1000).toFixed(1)}s
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </ScrollReveal>
        )),
      )}
    </>
  );
}
