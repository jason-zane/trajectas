import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ParticipantOverviewPanel } from "./participant-overview-panel";
import { ParticipantActivityPanel } from "./participant-activity-panel";
import { ParticipantSessionsPanel } from "./participant-sessions-panel";
import { ParticipantReportsPanel } from "./participant-reports-panel";
import type {
  ParticipantDetail,
  ParticipantSession,
  ActivityEvent,
} from "@/app/actions/participants";
import type { ReportSnapshot } from "@/types/database";

type SnapshotWithTemplate = ReportSnapshot & { templateName?: string };

interface ParticipantDetailViewProps {
  participant: ParticipantDetail;
  sessions: ParticipantSession[];
  activity: ActivityEvent[];
  snapshots: SnapshotWithTemplate[];
  backHref: string;
  backLabel: string;
  sessionBaseHref: string;
}

function statusVariant(
  status: string
): "default" | "secondary" | "outline" | "destructive" {
  if (status === "completed") return "default";
  if (status === "in_progress" || status === "registered") return "secondary";
  if (status === "withdrawn" || status === "expired") return "destructive";
  return "outline";
}

function getInitials(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

export function ParticipantDetailView({
  participant,
  sessions,
  activity,
  snapshots,
  backHref,
  backLabel,
  sessionBaseHref,
}: ParticipantDetailViewProps) {
  const displayName =
    `${participant.firstName ?? ""} ${participant.lastName ?? ""}`.trim() ||
    participant.email;

  return (
    <div className="space-y-6 max-w-6xl">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        {backLabel}
      </Link>

      <div className="flex items-start gap-4">
        <Avatar className="size-14">
          <AvatarFallback>{getInitials(displayName, participant.email)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <PageHeader
            eyebrow="Participant"
            title={displayName}
            description={`${participant.email}${
              participant.clientName ? ` · ${participant.clientName}` : ""
            } · ${participant.campaignTitle}`}
          >
            <Badge variant={statusVariant(participant.status)} className="uppercase">
              {participant.status}
            </Badge>
          </PageHeader>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <ParticipantOverviewPanel
            participant={participant}
            sessions={sessions}
            sessionBaseHref={sessionBaseHref}
          />
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <ParticipantActivityPanel activity={activity} />
        </TabsContent>

        <TabsContent value="sessions" className="mt-6">
          <ParticipantSessionsPanel
            sessions={sessions}
            sessionBaseHref={sessionBaseHref}
          />
        </TabsContent>

        <TabsContent value="reports" className="mt-6">
          <ParticipantReportsPanel
            snapshots={snapshots}
            sessionBaseHref={sessionBaseHref}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
