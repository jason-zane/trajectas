import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { AuthorizedScope } from "@/lib/auth/authorization";

/**
 * What a partner is actually allocated.
 *
 * A platform-owned assessment or report template (both owner columns null) is
 * NOT automatically shared with every partner. The platform allocates them, one
 * row at a time, through `partner_assessment_assignments` and
 * `partner_report_template_assignments` — that is the whole point of those
 * tables, and of the quota caps on the first.
 *
 * The listings did not ask. They matched the older "platform-owned means shared
 * library" assumption, so a brand-new partner with nothing allocated saw the
 * entire platform catalogue: every assessment including drafts, and every
 * report template. That is other people's product, visible to a separate
 * business, before any commercial arrangement exists.
 *
 * `null` means unrestricted — the caller is not confined to a partner, so there
 * is nothing to narrow. A platform admin on the admin surface gets `null`; a
 * partner gets their allocation, which may legitimately be empty.
 */

/** Partner ids this scope is confined to, or `null` when it is not confined. */
function confinedPartnerIds(scope: AuthorizedScope): string[] | null {
  // A platform admin on the admin host sees the platform's own library. Off
  // that host — a support session into a partner portal, say — they are
  // confined exactly like the partner they are standing in.
  if (scope.isPlatformAdmin) return null;
  // No partner membership means the caller is not confined to a partner at all
  // — a client admin, say. Partner allocation has nothing to say about them, so
  // they keep whatever the caller's own rules allow.
  const partnerIds = scope.partnerIds ?? [];
  if (partnerIds.length === 0) return null;
  return partnerIds;
}

async function allocatedIds(
  scope: AuthorizedScope,
  table: "partner_assessment_assignments" | "partner_report_template_assignments",
  column: "assessment_id" | "report_template_id"
): Promise<string[] | null> {
  const partnerIds = confinedPartnerIds(scope);
  if (partnerIds === null) return null;

  const db = createAdminClient();
  const { data, error } = await db
    .from(table)
    .select(column)
    .in("partner_id", partnerIds)
    .eq("is_active", true);

  // Fail closed. An allocation lookup that errors must not fall back to
  // "show everything" — that is the bug this exists to prevent.
  if (error) return [];

  return Array.from(
    new Set((data ?? []).map((row) => String((row as Record<string, unknown>)[column])))
  );
}

/**
 * Platform-owned assessments this scope may see, or `null` for unrestricted.
 * Partner-OWNED assessments are not listed here — they belong to the partner
 * outright and need no allocation.
 */
export async function getAllocatedAssessmentIds(scope: AuthorizedScope) {
  return allocatedIds(scope, "partner_assessment_assignments", "assessment_id");
}

/** Platform-owned report templates this scope may see, or `null`. */
export async function getAllocatedReportTemplateIds(scope: AuthorizedScope) {
  return allocatedIds(
    scope,
    "partner_report_template_assignments",
    "report_template_id"
  );
}
