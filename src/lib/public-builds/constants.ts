import "server-only";

import type { AuthorizedScope } from "@/lib/auth/authorization";

/**
 * Fixed-UUID system client that owns every assessment/campaign the public
 * Role Builder (/build) creates. Guaranteed to exist by
 * supabase/migrations/20260917100000_public_builds_client_and_tables.sql —
 * mirrors PREVIEW_SAMPLE_CLIENT_ID (src/lib/sample-data/seed-preview.ts).
 */
export const PUBLIC_BUILDS_CLIENT_ID = "00000000-0000-4000-8000-0000c0de6001";

/**
 * A fixed, non-request-derived AuthorizedScope representing "an admin of the
 * public-builds client". Passed as `opts.systemScope` to createAssessment,
 * createCampaign, and sendParticipantInviteEmail so the public Role Builder's
 * six cookie-gated actions (src/app/actions/public-builds.ts) can create real
 * records without an interactive admin session. It still runs through the
 * same canManageAssessmentLibrary / canManageClient / canManageCampaign
 * checks those functions already enforce for every other caller — this is
 * dependency injection of one legitimate, narrowly-scoped actor, not a new
 * authorization path. See "Server side" in
 * docs/superpowers/specs/2026-09-17-public-role-builder-design.md.
 */
export const PUBLIC_BUILDS_SYSTEM_SCOPE: AuthorizedScope = {
  actor: null,
  activeContext: null,
  previewContext: null,
  requestSurface: "public",
  isPlatformAdmin: false,
  isLocalDevelopmentBypass: false,
  partnerIds: [],
  partnerAdminIds: [],
  clientIds: [PUBLIC_BUILDS_CLIENT_ID],
  clientAdminIds: [PUBLIC_BUILDS_CLIENT_ID],
  managedClientIds: [PUBLIC_BUILDS_CLIENT_ID],
  isLocalDevelopment: false,
  supportSession: null,
};

/** Fixed items per capability for every public build, bypassing item_selection_rules bands. */
export const PUBLIC_BUILDS_ITEMS_PER_FACTOR = 6;

export type PublicBuildTier = "essentials" | "core" | "full";

export const PUBLIC_BUILDS_TIERS: Record<PublicBuildTier, { capabilities: number; label: string }> = {
  essentials: { capabilities: 4, label: "Essentials" },
  core: { capabilities: 6, label: "Core" },
  full: { capabilities: 8, label: "Full picture" },
};

/** Input caps — half the internal Architect's limits (40k chars / 10 MB). */
export const PUBLIC_BUILDS_MAX_PD_CHARS = 20_000;
export const PUBLIC_BUILDS_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const PUBLIC_BUILDS_CODE_EXPIRY_MS = 10 * 60 * 1000;
export const PUBLIC_BUILDS_CODE_MAX_ATTEMPTS = 5;
export const PUBLIC_BUILDS_COOKIE_TTL_MS = 24 * 60 * 60 * 1000;

export const PUBLIC_BUILDS_MAX_BUILDS_PER_EMAIL_PER_DAY = 3;

export type PublicBuildsMode = "closed" | "open" | "off";

export function getPublicBuildsMode(): PublicBuildsMode {
  const mode = process.env.PUBLIC_BUILDS_MODE;
  if (mode === "closed" || mode === "open") return mode;
  return "off";
}

export function getPublicBuildsDailyCap(): number {
  const raw = Number(process.env.PUBLIC_BUILDS_DAILY_CAP);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 100;
}
