import { EmptyState } from "@/components/empty-state";
import type {
  SessionDetailScore,
  SessionDetailDimensionScore,
} from "@/app/actions/sessions";
import type { ParticipantSessionProcessingStatus } from "@/types/database";
import { FactorScoreRow } from "./factor-score-row";
import { byDisplayOrder } from "@/lib/taxonomy-order";

interface SessionScoresPanelProps {
  scores: SessionDetailScore[];
  dimensionScores: SessionDetailDimensionScore[];
  compositeScore?: number;
  sessionStatus: string;
  processingStatus: ParticipantSessionProcessingStatus;
  processingError?: string;
  sessionId: string;
  /** When true, each score row gets an expand-to-constructs drilldown.
   *  Platform admins only — gated by the calling page. */
  showConstructDrilldown?: boolean;
}

const UNGROUPED_KEY = "__ungrouped__";
const UNGROUPED_LABEL = "Other";

interface ScoreGroup {
  key: string;
  label: string | null;
  /** Authored `dimensions.display_order`. Ungrouped rows sort last regardless. */
  displayOrder: number;
  groupScore?: number;
  scores: SessionDetailScore[];
}

/** Capabilities read in framework order, matching the report — name ascending. */
function sortScores(scores: SessionDetailScore[]): SessionDetailScore[] {
  return [...scores].sort((a, b) => a.entityName.localeCompare(b.entityName));
}

function groupScores(
  scores: SessionDetailScore[],
  dimensionScores: SessionDetailDimensionScore[],
): ScoreGroup[] {
  const dimensionScoreById = new Map<string, number>();
  for (const dim of dimensionScores) {
    dimensionScoreById.set(dim.dimensionId, dim.scaledScore);
  }

  const hasAnyDimension = scores.some((s) => s.dimensionId);
  if (!hasAnyDimension) {
    return [
      {
        key: UNGROUPED_KEY,
        label: null,
        displayOrder: 0,
        scores: sortScores(scores),
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
        displayOrder: score.dimensionDisplayOrder ?? 0,
        groupScore:
          score.dimensionId != null
            ? dimensionScoreById.get(score.dimensionId)
            : undefined,
        scores: [score],
      });
    }
  }

  return Array.from(buckets.values())
    .map((group) => ({ ...group, scores: sortScores(group.scores) }))
    .sort((a, b) => {
      if (a.key === UNGROUPED_KEY) return 1;
      if (b.key === UNGROUPED_KEY) return -1;
      return byDisplayOrder(
        { displayOrder: a.displayOrder, name: a.label },
        { displayOrder: b.displayOrder, name: b.label },
      );
    });
}

export function SessionScoresPanel({
  scores,
  dimensionScores,
  compositeScore,
  sessionStatus,
  processingStatus,
  processingError,
  sessionId,
  showConstructDrilldown = false,
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

  const groups = groupScores(scores, dimensionScores);

  return (
    <div className="space-y-5">
      {compositeScore != null && (
        <div className="flex items-center justify-between gap-6 rounded-lg border border-border bg-card px-5 py-3.5">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Overall
            </span>
            <span className="text-caption text-muted-foreground">
              Mean of {scores.length} {scores.length === 1 ? "score" : "scores"}
            </span>
          </div>
          <span className="text-3xl font-bold tabular-nums tracking-tight">
            {Math.round(compositeScore)}
          </span>
        </div>
      )}

      {groups.map((group) => (
        <div key={group.key} className="space-y-2">
          {group.label != null && (
            <div className="flex items-baseline justify-between gap-4 border-b border-border pb-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                {group.label}
              </h3>
              {group.groupScore != null && (
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {Math.round(group.groupScore)}
                </span>
              )}
            </div>
          )}
          <div className="space-y-0.5">
            {group.scores.map((score) => (
              <FactorScoreRow
                key={score.entityId}
                score={score}
                sessionId={sessionId}
                enableDrilldown={showConstructDrilldown}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
