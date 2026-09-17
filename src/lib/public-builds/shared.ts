/**
 * Constants safe to import from client components (no "server-only", no env
 * reads, no server-only types). Server-only config lives in ./constants.ts.
 */

export type PublicBuildTier = "essentials" | "core" | "full";

export const PUBLIC_BUILDS_TIERS: Record<PublicBuildTier, { capabilities: number; label: string; blurb: string }> = {
  essentials: { capabilities: 4, label: "Essentials", blurb: "The few that decide this role." },
  core: { capabilities: 6, label: "Core", blurb: "Enough to compare people with confidence." },
  full: { capabilities: 8, label: "Full picture", blurb: "The role, and what helps someone grow into it." },
};

export const PUBLIC_BUILDS_TIER_ORDER: PublicBuildTier[] = ["essentials", "core", "full"];

/** Fixed items per capability for every public build, bypassing item_selection_rules bands. */
export const PUBLIC_BUILDS_ITEMS_PER_FACTOR = 6;

export const PUBLIC_BUILDS_MAX_PD_CHARS = 20_000;
