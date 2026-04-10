"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ResultsByParticipantTable } from "./results-by-participant-table";
import { ResultsBySessionTable } from "./results-by-session-table";
import type { ParticipantWithMeta } from "@/app/actions/participants";
import type { CampaignSessionRow } from "@/app/actions/sessions";

interface CampaignResultsHubProps {
  campaignTitle: string;
  participants: ParticipantWithMeta[];
  sessions: CampaignSessionRow[];
  participantHref: (p: ParticipantWithMeta) => string;
  sessionHref: (s: CampaignSessionRow) => string;
}

export function CampaignResultsHub({
  campaignTitle,
  participants,
  sessions,
  participantHref,
  sessionHref,
}: CampaignResultsHubProps) {
  const [view, setView] = useState<"participants" | "sessions">("participants");

  const invited = participants.length;
  const started = participants.filter(
    (p) => p.status === "in_progress" || p.status === "completed"
  ).length;
  const completed = participants.filter((p) => p.status === "completed").length;
  const pct = invited > 0 ? Math.round((completed / invited) * 100) : 0;

  // Build assessment options for the by-session filter.
  // Both value and label must be the title string since the filter column
  // is `assessmentTitle`.
  const assessmentOptions = Array.from(
    new Set(sessions.map((s) => s.assessmentTitle))
  ).map((title) => ({ value: title, label: title }));

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        eyebrow="Results"
        title={campaignTitle}
        description="Participant and session results for this campaign."
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatBox label="Invited" value={invited} />
        <StatBox label="Started" value={started} />
        <StatBox label="Completed" value={completed} />
        <StatBox label="Completion rate" value={`${pct}%`} />
      </div>

      <div className="flex items-center gap-1 rounded-lg bg-muted p-1 w-fit">
        <button
          type="button"
          onClick={() => setView("participants")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            view === "participants"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          By participant
        </button>
        <button
          type="button"
          onClick={() => setView("sessions")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            view === "sessions"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          By session
        </button>
      </div>

      {view === "participants" ? (
        <ResultsByParticipantTable
          participants={participants}
          participantHref={participantHref}
        />
      ) : (
        <ResultsBySessionTable
          sessions={sessions}
          sessionHref={sessionHref}
          assessmentOptions={assessmentOptions}
        />
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="py-4 px-5">
        <p className="text-caption text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tabular-nums mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}
