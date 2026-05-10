import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
    <div className="grid gap-4 md:grid-cols-2">
      {sorted.map((score) => {
        const pct = Math.max(0, Math.min(100, score.scaledScore));
        return (
          <Card key={score.factorId}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{score.factorName}</CardTitle>
                <Badge variant="outline" className="uppercase text-xs">
                  {score.scoringMethod}
                </Badge>
              </div>
              <p className="text-caption text-muted-foreground">
                {score.itemsUsed} item{score.itemsUsed !== 1 ? "s" : ""}
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-3xl font-bold tabular-nums">
                  {Math.round(score.scaledScore)}
                </span>
                {score.percentile != null && (
                  <Badge variant="secondary">
                    {Math.round(score.percentile)}th percentile
                  </Badge>
                )}
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              {score.confidenceLower != null && score.confidenceUpper != null && (
                <p className="text-caption text-muted-foreground mt-2">
                  CI: {Math.round(score.confidenceLower)}–{Math.round(score.confidenceUpper)}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
