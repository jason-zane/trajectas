/**
 * Constants safe to import from client components (no "server-only", no env
 * reads, no server-only types). Server-only config lives in ./constants.ts.
 */

import { estimateAssessmentDurationMinutes } from "@/lib/assessments/duration";

export type PublicBuildTier = "essentials" | "core" | "full";

export const PUBLIC_BUILDS_TIERS: Record<
  PublicBuildTier,
  { capabilities: number; label: string; blurb: string }
> = {
  essentials: {
    capabilities: 4,
    label: "Essentials",
    blurb: "The few that decide this role.",
  },
  core: {
    capabilities: 6,
    label: "Core",
    blurb: "Enough to compare people with confidence.",
  },
  full: {
    capabilities: 8,
    label: "Full picture",
    blurb: "The role, and what helps someone grow into it.",
  },
};

export const PUBLIC_BUILDS_TIER_ORDER: PublicBuildTier[] = [
  "essentials",
  "core",
  "full",
];

/** Fixed items per capability for every public build, bypassing item_selection_rules bands. */
export const PUBLIC_BUILDS_ITEMS_PER_FACTOR = 6;

export const PUBLIC_BUILDS_MAX_PD_CHARS = 20_000;

/**
 * Minutes a public build of `capabilities` capabilities takes — the one
 * number every screen quotes, derived from the same fixed items-per-capability
 * that createBuild sizes the assessment with.
 */
export function estimatePublicBuildMinutes(capabilities: number): number {
  return estimateAssessmentDurationMinutes(
    capabilities * PUBLIC_BUILDS_ITEMS_PER_FACTOR,
  );
}

export interface PublicBuildStageUsage {
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
}

/** Total tokens across every AI stage of a build, reasoning included. */
export function sumPublicBuildTokens(
  usage:
    | Record<string, PublicBuildStageUsage | null | undefined>
    | null
    | undefined,
): number {
  if (!usage) return 0;
  return Object.values(usage).reduce(
    (sum, stage) =>
      sum +
      (stage?.inputTokens ?? 0) +
      (stage?.outputTokens ?? 0) +
      (stage?.reasoningTokens ?? 0),
    0,
  );
}

/** The UTC day boundary every "today" (daily cap, per-email cap, admin meter) is measured from. */
export function startOfUtcDayIso(now = new Date()): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();
}
