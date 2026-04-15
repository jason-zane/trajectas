import { EmptyState } from "@/components/empty-state";
import type { SessionDetailScore } from "@/app/actions/sessions";
import type { ParticipantSessionProcessingStatus } from "@/types/database";

interface SessionScoresPanelProps {
  scores: SessionDetailScore[];
  sessionStatus: string;
  processingStatus: ParticipantSessionProcessingStatus;
  processingError?: string;
}

export function SessionScoresPanel({
  scores,
  sessionStatus,
  processingStatus,
  processingError,
}: SessionScoresPanelProps) {
  if (scores.length === 0) {
    const description =
      sessionStatus !== "completed"
        ? "Scores will appear here after the participant completes the assessment."
        : processingStatus === "scoring"
          ? "Scores are still being calculated for this session."
          : processingStatus === "failed"
            ? processingError ??
              "This session completed, but scoring did not finish successfully."
            : processingStatus === "reporting"
              ? "Scores are being finalized while report generation runs."
              : "Scores will appear here when this session is completed and scored.";

    return (
      <EmptyState
        title="No scores yet"
        description={description}
      />
    );
  }

  const sorted = [...scores].sort((a, b) => b.scaledScore - a.scaledScore);

  return (
    <div className="space-y-2">
      {sorted.map((score) => {
        const pct = Math.max(0, Math.min(100, score.scaledScore));
        const value = Math.round(score.scaledScore);
        return (
          <div key={score.factorId} className="flex items-center gap-4 py-2">
            <span className="w-48 shrink-0 truncate text-sm font-medium">
              {score.factorName}
            </span>
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums">
              {value}
            </span>
          </div>
        );
      })}
    </div>
  );
}
