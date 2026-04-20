/**
 * Canonical estimate of how long an assessment takes to complete, in minutes.
 *
 * Used across the platform — assessment library cards, quick-launch picker,
 * capability-selection summary, welcome screen — so a participant and an
 * admin see the same number for the same item count. Based on 12 seconds
 * per item.
 *
 * If sections have explicit `timeLimitSeconds`, prefer those since they
 * reflect the author's chosen duration.
 */
const SECONDS_PER_ITEM = 12;

export function estimateAssessmentDurationMinutes(
  totalItems: number,
  sectionTimeLimits: Array<number | null> = [],
): number {
  const explicitSeconds = sectionTimeLimits.reduce<number>(
    (sum, seconds) => sum + (seconds ?? 0),
    0,
  );
  if (explicitSeconds > 0) {
    return Math.max(1, Math.ceil(explicitSeconds / 60));
  }

  if (totalItems <= 0) return 0;
  return Math.max(1, Math.round((totalItems * SECONDS_PER_ITEM) / 60));
}
