import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowRight, ClipboardList, CheckCircle2, Clock, Mail } from "lucide-react";
import { ScrollReveal } from "@/components/scroll-reveal";
import { TiltCard } from "@/components/tilt-card";
import { LocalTime } from "@/components/local-time";
import type { ParticipantDetail, ParticipantSession } from "@/app/actions/participants";

interface ParticipantOverviewPanelProps {
  participant: ParticipantDetail;
  sessions: ParticipantSession[];
  sessionBaseHref: string;
}

function formatDuration(start: string, end: string): string {
  const minutes = Math.max(
    0,
    Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
  );
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function ParticipantOverviewPanel({
  participant,
  sessions,
  sessionBaseHref,
}: ParticipantOverviewPanelProps) {
  const totalSessions = sessions.length;
  const completedSessions = sessions.filter((s) => s.status === "completed").length;
  const totalTime =
    participant.startedAt && participant.completedAt
      ? formatDuration(participant.startedAt, participant.completedAt)
      : null;

  const stats = [
    {
      key: "total",
      label: "Sessions",
      value: totalSessions,
      description: `${completedSessions} completed`,
      icon: ClipboardList,
      bgClass: "bg-primary/10",
      iconClass: "text-primary",
    },
    {
      key: "completed",
      label: "Completed",
      value: completedSessions,
      description: `of ${totalSessions}`,
      icon: CheckCircle2,
      bgClass: "bg-brand/10",
      iconClass: "text-brand",
    },
    {
      key: "time",
      label: "Total time",
      value: totalTime ?? "—",
      description: totalTime ? "From start to completion" : "Not completed",
      icon: Clock,
      bgClass: "bg-accent",
      iconClass: "text-accent-foreground",
    },
  ];

  const recent = [...sessions]
    .filter((s) => s.startedAt)
    .sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""))[0];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat, index) => (
          <ScrollReveal key={stat.key} delay={index * 60}>
            <TiltCard>
              <Card variant="interactive">
                <CardContent className="flex items-start justify-between gap-4 py-5">
                  <div>
                    <p className="text-3xl font-bold tabular-nums">{stat.value}</p>
                    <p className="text-caption text-muted-foreground mt-1">
                      {stat.label}
                    </p>
                    <p className="text-caption text-muted-foreground">
                      {stat.description}
                    </p>
                  </div>
                  <div
                    className={`flex size-10 items-center justify-center rounded-xl ${stat.bgClass}`}
                  >
                    <stat.icon className={`size-5 ${stat.iconClass}`} />
                  </div>
                </CardContent>
              </Card>
            </TiltCard>
          </ScrollReveal>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="size-4" />
              <span className="text-foreground">{participant.email}</span>
            </div>
            <div>
              <p className="text-caption text-muted-foreground">Campaign</p>
              <p className="font-medium">{participant.campaignTitle}</p>
            </div>
            {participant.clientName && (
              <div>
                <p className="text-caption text-muted-foreground">Client</p>
                <p className="font-medium">{participant.clientName}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <p className="text-caption text-muted-foreground">Invited</p>
                <p className="font-medium">
                  <LocalTime iso={participant.invitedAt} format="date" />
                </p>
              </div>
              <div>
                <p className="text-caption text-muted-foreground">Completed</p>
                <p className="font-medium">
                  <LocalTime iso={participant.completedAt} format="date" />
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {recent && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Most recent session</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="font-medium">{recent.assessmentTitle}</p>
                <Badge variant="outline" className="mt-1">
                  {recent.status}
                </Badge>
              </div>
              <p className="text-caption text-muted-foreground">
                Started <LocalTime iso={recent.startedAt} format="relative" />
              </p>
              <Link
                href={`${sessionBaseHref}/${recent.id}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                View session
                <ArrowRight className="size-4" />
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
