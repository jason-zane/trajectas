import { EmptyState } from "@/components/empty-state";
import type { SessionDetailScore } from "@/app/actions/sessions";
import type { ParticipantSessionProcessingStatus } from "@/types/database";

interface SessionScoresPanelProps {
  scores: SessionDetailScore[];
  sessionStatus: string;
  processingStatus: ParticipantSessionProcessingStatus;
  processingError?: string;
}

const UNGROUPED_KEY = "__ungrouped__";
const UNGROUPED_LABEL = "Other";

interface ScoreGroup {
  key: string;
  label: string | null;
  scores: SessionDetailScore[];
}

function groupScores(scores: SessionDetailScore[]): ScoreGroup[] {
  const hasAnyDimension = scores.some((s) => s.dimensionId);
  if (!hasAnyDimension) {
    return [
      {
        key: UNGROUPED_KEY,
        label: null,
        scores: [...scores].sort((a, b) => b.scaledScore - a.scaledScore),
      },
    ];
  }

  const buckets = new Map<string, ScoreGroup>();
  for (const score of scores) {
    const key = score.dimensionId ?? UNGROUPED_KEY;
    const existing = buckets.get(key);
    if (existing) {
      existing.scores.push(score);
    } else {
      buckets.set(key, {
        key,
        label:
          score.dimensionId == null
            ? UNGROUPED_LABEL
            : (score.dimensionName ?? "Unnamed dimension"),
        scores: [score],
      });
    }
  }

  return Array.from(buckets.values())
    .map((group) => ({
      ...group,
      scores: group.scores.sort((a, b) => b.scaledScore - a.scaledScore),
    }))
    .sort((a, b) => {
      if (a.key === UNGROUPED_KEY) return 1;
      if (b.key === UNGROUPED_KEY) return -1;
      return (a.label ?? "").localeCompare(b.label ?? "");
    });
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
            ? (processingError ??
              "This session completed, but scoring did not finish successfully.")
            : processingStatus === "reporting"
              ? "Scores are being finalized while report generation runs."
              : "Scores will appear here when this session is completed and scored.";

    return <EmptyState title="No scores yet" description={description} />;
  }

  const groups = groupScores(scores);

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.key} className="space-y-2">
          {group.label != null && (
            <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
              {group.label}
            </h3>
          )}
          <div className="space-y-2">
            {group.scores.map((score) => {
              const pct = Math.max(0, Math.min(100, score.scaledScore));
              const value = Math.round(score.scaledScore);
              return (
                <div
                  key={score.entityId}
                  className="flex items-center gap-4 py-2"
                >
                  <span className="w-48 shrink-0 truncate text-sm font-medium">
                    {score.entityName}
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
        </div>
      ))}
    </div>
  );
}
