import Link from "next/link";
import { ExternalLink } from "lucide-react";
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
import { LocalTime } from "@/components/local-time";
import { getSessionProcessingStatusLabel } from "@/lib/assess/session-processing";
import type { ParticipantSession } from "@/app/actions/participants";

interface ParticipantSessionsPanelProps {
  sessions: ParticipantSession[];
  sessionBaseHref: string;
}

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "completed") return "default";
  if (status === "in_progress") return "secondary";
  if (status === "expired") return "destructive";
  return "outline";
}

function processingVariant(
  status: string,
): "default" | "secondary" | "outline" | "destructive" {
  if (status === "ready") return "default";
  if (status === "scoring" || status === "reporting") return "secondary";
  if (status === "failed") return "destructive";
  return "outline";
}

function computeAttempts(sessions: ParticipantSession[]): Map<string, number> {
  const byAssessment = new Map<string, ParticipantSession[]>();
  for (const s of sessions) {
    const list = byAssessment.get(s.assessmentId) ?? [];
    list.push(s);
    byAssessment.set(s.assessmentId, list);
  }
  const attempts = new Map<string, number>();
  for (const list of byAssessment.values()) {
    list
      .slice()
      .sort((a, b) => (a.startedAt ?? "").localeCompare(b.startedAt ?? ""))
      .forEach((s, idx) => attempts.set(s.id, idx + 1));
  }
  return attempts;
}

export function ParticipantSessionsPanel({
  sessions,
  sessionBaseHref,
}: ParticipantSessionsPanelProps) {
  if (sessions.length === 0) {
    return (
      <EmptyState
        variant="default"
        title="No sessions yet"
        description="Assessment sessions will appear here once the participant starts."
      />
    );
  }

  const attempts = computeAttempts(sessions);

  return (
    <div className="rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Assessment</TableHead>
            <TableHead>Attempt</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Started</TableHead>
            <TableHead>Completed</TableHead>
            <TableHead>Scores</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.map((session) => (
            <TableRow key={session.id}>
              <TableCell>
                <Link
                  href={`${sessionBaseHref}/${session.id}`}
                  className="font-medium hover:text-primary transition-colors"
                >
                  {session.assessmentTitle}
                </Link>
              </TableCell>
              <TableCell className="tabular-nums">
                #{attempts.get(session.id) ?? 1}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusVariant(session.status)}>
                    {session.status}
                  </Badge>
                  {session.status === "completed" && (
                    <Badge variant={processingVariant(session.processingStatus)}>
                      {getSessionProcessingStatusLabel(session.processingStatus)}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                <LocalTime iso={session.startedAt} format="date-time" />
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                <LocalTime iso={session.completedAt} format="date-time" />
              </TableCell>
              <TableCell className="tabular-nums">
                {session.scores?.length ?? 0}
              </TableCell>
              <TableCell>
                <Link
                  href={`${sessionBaseHref}/${session.id}`}
                  className="text-muted-foreground hover:text-primary"
                >
                  <ExternalLink className="size-4" />
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
