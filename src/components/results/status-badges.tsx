import { Badge } from "@/components/ui/badge";
import { getSessionProcessingStatusLabel } from "@/lib/assess/session-processing";
import type { ParticipantSessionProcessingStatus } from "@/types/database";

type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

const SESSION_STATUS_VARIANT: Record<string, BadgeVariant> = {
  completed: "default",
  in_progress: "secondary",
  expired: "destructive",
};

const SESSION_STATUS_LABEL: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
  expired: "Expired",
};

const PROCESSING_VARIANT: Record<ParticipantSessionProcessingStatus, BadgeVariant> = {
  idle: "outline",
  scoring: "secondary",
  scored: "secondary",
  reporting: "secondary",
  ready: "default",
  failed: "destructive",
};

const PARTICIPANT_STATUS_VARIANT: Record<string, BadgeVariant> = {
  invited: "secondary",
  registered: "outline",
  in_progress: "secondary",
  completed: "default",
  withdrawn: "destructive",
  expired: "destructive",
};

export const PARTICIPANT_STATUS_LABEL: Record<string, string> = {
  invited: "Invited",
  registered: "Registered",
  in_progress: "In progress",
  completed: "Completed",
  withdrawn: "Withdrawn",
  expired: "Expired",
};

export function SessionStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={SESSION_STATUS_VARIANT[status] ?? "outline"}>
      {SESSION_STATUS_LABEL[status] ?? status.replace(/_/g, " ")}
    </Badge>
  );
}

export function SessionProcessingBadge({
  status,
}: {
  status: ParticipantSessionProcessingStatus;
}) {
  return (
    <Badge variant={PROCESSING_VARIANT[status] ?? "outline"}>
      {getSessionProcessingStatusLabel(status)}
    </Badge>
  );
}

export function ParticipantStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={PARTICIPANT_STATUS_VARIANT[status] ?? "secondary"}>
      {PARTICIPANT_STATUS_LABEL[status] ?? status.replace(/_/g, " ")}
    </Badge>
  );
}

export {
  PARTICIPANT_STATUS_VARIANT,
  SESSION_STATUS_VARIANT,
  SESSION_STATUS_LABEL,
  PROCESSING_VARIANT,
};
