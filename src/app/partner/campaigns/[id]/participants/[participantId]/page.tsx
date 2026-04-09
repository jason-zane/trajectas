import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  Calendar,
  Check,
  Mail,
  Timer,
  Users,
} from "lucide-react";
import {
  getParticipant,
  getParticipantSessions,
  getParticipantActivity,
} from "@/app/actions/participants";
import { resolveWorkspaceAccess } from "@/lib/auth/workspace-access";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(value?: string) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value?: string) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDuration(start?: string, end?: string) {
  if (!start || !end) return null;
  const minutes = Math.max(
    0,
    Math.round(
      (new Date(end).getTime() - new Date(start).getTime()) / 60000,
    ),
  );
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function statusBadgeVariant(status: string) {
  switch (status) {
    case "active":
    case "completed":
      return "default";
    case "draft":
    case "pending":
      return "secondary";
    case "paused":
    case "archived":
    case "closed":
      return "outline";
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
}

function MetricCard({
  label,
  value,
  description,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 py-5">
        <div>
          <p className="text-3xl font-semibold tracking-tight">{value}</p>
          <p className="mt-1 text-sm font-medium">{label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
          <Icon className="size-5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PartnerParticipantDetailPage({
  params,
}: {
  params: Promise<{ id: string; participantId: string }>;
}) {
  const { id: campaignId, participantId } = await params;

  const [participant, sessions, activity, access] = await Promise.all([
    getParticipant(participantId),
    getParticipantSessions(participantId),
    getParticipantActivity(participantId),
    resolveWorkspaceAccess("partner"),
  ]);

  const canExportReports = access.status === "ok" && access.canExportReports;

  const backLink = (
    <Link
      href={`/partner/campaigns/${campaignId}`}
      className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
    >
      <ArrowLeft className="size-4" />
      Back to campaign
    </Link>
  );

  if (!participant || participant.campaignId !== campaignId) {
    return (
      <div className="max-w-6xl space-y-8">
        <PageHeader eyebrow="Participants" title="Participant detail" description="Participant not found.">
          {backLink}
        </PageHeader>
        <Card>
          <CardHeader>
            <CardTitle>Participant not available</CardTitle>
            <CardDescription>
              This participant does not exist or is not part of this campaign.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const displayName =
    participant.firstName || participant.lastName
      ? `${participant.firstName ?? ""} ${participant.lastName ?? ""}`.trim()
      : participant.email;

  const completedSessions = sessions.filter(
    (session) => session.status === "completed",
  ).length;

  const totalDuration = formatDuration(
    participant.startedAt,
    participant.completedAt,
  );

  const totalMinutes =
    participant.startedAt && participant.completedAt
      ? Math.max(
          0,
          Math.round(
            (new Date(participant.completedAt).getTime() -
              new Date(participant.startedAt).getTime()) /
              60000,
          ),
        )
      : null;

  const eyebrow =
    participant.status.charAt(0).toUpperCase() + participant.status.slice(1);

  return (
    <div className="max-w-6xl space-y-8">
      <PageHeader
        eyebrow={eyebrow}
        title={displayName}
        description={participant.email}
      >
        <div className="flex flex-wrap gap-3">
          {backLink}
          {participant.status === "completed" ? (
            <>
              <Link
                href={`/partner/reports/participants/${participant.id}`}
                className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Open participant report
              </Link>
              {canExportReports ? (
                <Link
                  href={`/partner/exports/participants/${participant.id}`}
                  className="inline-flex items-center rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Export report
                </Link>
              ) : null}
            </>
          ) : null}
        </div>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label="Assessments completed"
          value={completedSessions}
          description={`${sessions.length} session(s) in total`}
          icon={Check}
        />
        <MetricCard
          label="Total time"
          value={totalMinutes ?? 0}
          description={totalDuration ?? "Not completed yet"}
          icon={Timer}
        />
        <MetricCard
          label="Activity events"
          value={activity.length}
          description="Auditable milestones in this participant journey"
          icon={Activity}
        />
        <MetricCard
          label="Status"
          value={eyebrow}
          description={
            participant.completedAt
              ? `Completed ${formatDate(participant.completedAt)}`
              : participant.startedAt
                ? `Started ${formatDate(participant.startedAt)}`
                : "Not yet started"
          }
          icon={Users}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Participant overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                Email
              </p>
              <p className="font-medium">{participant.email}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                Campaign
              </p>
              <p className="font-medium">{participant.campaignTitle}</p>
            </div>
            {participant.clientName ? (
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                  Client
                </p>
                <p className="font-medium">{participant.clientName}</p>
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border/70 p-3">
                <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                  <Mail className="size-3.5" />
                  Invited
                </div>
                <p className="font-medium">
                  {formatDateTime(participant.invitedAt)}
                </p>
              </div>
              <div className="rounded-lg border border-border/70 p-3">
                <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                  <Calendar className="size-3.5" />
                  Completed
                </div>
                <p className="font-medium">
                  {formatDateTime(participant.completedAt)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assessment sessions</CardTitle>
            <CardDescription>
              Assessment sessions for this participant
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No assessment sessions are visible yet.
              </p>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className="rounded-lg border border-border/70 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{session.assessmentTitle}</p>
                      <p className="text-xs text-muted-foreground">
                        Started {formatDateTime(session.startedAt)} &bull;{" "}
                        Completed {formatDateTime(session.completedAt)}
                      </p>
                    </div>
                    <Badge variant={statusBadgeVariant(session.status)}>
                      {session.status}
                    </Badge>
                  </div>
                  {session.scores.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {session.scores.slice(0, 4).map((score) => (
                        <Badge
                          key={`${session.id}-${score.factorId}`}
                          variant="outline"
                        >
                          {score.factorName}: {Math.round(score.scaledScore)}
                        </Badge>
                      ))}
                      {session.scores.length > 4 ? (
                        <Badge variant="secondary">
                          +{session.scores.length - 4} more
                        </Badge>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity timeline</CardTitle>
          <CardDescription>Milestones and progress events</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No activity has been recorded yet.
            </p>
          ) : (
            activity.map((event, index) => (
              <div
                key={`${event.type}-${event.timestamp}-${index}`}
                className="flex items-start gap-3 rounded-lg border border-border/70 px-4 py-3"
              >
                <div className="mt-0.5 flex size-8 items-center justify-center rounded-full bg-muted">
                  <Activity className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{event.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(event.timestamp)}
                    {event.detail ? ` • ${event.detail}` : ""}
                  </p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
