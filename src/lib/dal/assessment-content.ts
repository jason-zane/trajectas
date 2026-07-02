import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { throwActionError } from "@/lib/security/action-errors";

type DbClient = SupabaseClient;

/**
 * Readiness summary of what an assessment can actually serve to a participant.
 *
 * The runner serves questions from `assessment_sections` →
 * `assessment_section_items` ONLY — NOT from `assessment_factors`, and NOT
 * from `forced_choice_blocks` (the section page redirects straight to
 * completion when there are no sections, whatever the format_mode; FC blocks
 * are builder-side configuration with no delivery path today). An assessment
 * whose factors link to constructs full of items still renders empty until a
 * persist step materialises those items into sections. These summaries let
 * write paths refuse to activate or distribute such a shell. If the runner
 * ever learns to serve FC blocks directly, extend the count here to match.
 */
export type AssessmentContentSummary = {
  assessmentId: string;
  title: string;
  formatMode: "traditional" | "forced_choice";
  /** Materialised question count in the runner's delivery tables. */
  itemCount: number;
  hasDeliverableContent: boolean;
};

function getNestedCount(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  const first = value[0] as { count?: number } | undefined;
  return typeof first?.count === "number" ? first.count : 0;
}

/**
 * One summary per requested assessment id (missing/deleted ids are omitted).
 * Queries are scoped to the injected client's trust boundary.
 */
export async function getAssessmentContentSummaries(
  db: DbClient,
  assessmentIds: string[],
): Promise<AssessmentContentSummary[]> {
  if (assessmentIds.length === 0) return [];

  const { data: assessments, error } = await db
    .from("assessments")
    .select("id, title, format_mode")
    .in("id", assessmentIds)
    .is("deleted_at", null);

  if (error) {
    throwActionError(
      "getAssessmentContentSummaries.assessments",
      "Unable to check assessment content.",
      error,
    );
  }

  const rows = (assessments ?? []) as Array<{
    id: string;
    title: string | null;
    format_mode: string | null;
  }>;
  if (rows.length === 0) return [];

  const itemCounts = new Map<string, number>();

  const { data: sections, error: sectionsError } = await db
    .from("assessment_sections")
    .select("assessment_id, assessment_section_items(count)")
    .in(
      "assessment_id",
      rows.map((r) => r.id),
    );

  if (sectionsError) {
    throwActionError(
      "getAssessmentContentSummaries.sections",
      "Unable to check assessment content.",
      sectionsError,
    );
  }

  for (const section of (sections ?? []) as Array<{
    assessment_id: string;
    assessment_section_items: unknown;
  }>) {
    itemCounts.set(
      section.assessment_id,
      (itemCounts.get(section.assessment_id) ?? 0) +
        getNestedCount(section.assessment_section_items),
    );
  }

  return rows.map((r) => {
    const itemCount = itemCounts.get(r.id) ?? 0;
    return {
      assessmentId: r.id,
      title: r.title ?? "Untitled",
      formatMode: r.format_mode === "forced_choice" ? "forced_choice" : "traditional",
      itemCount,
      hasDeliverableContent: itemCount > 0,
    };
  });
}

/**
 * Convenience for guard sites: the subset of the requested assessments that
 * have nothing to serve. An id that doesn't resolve to a live assessment row
 * is NOT reported here — existence checks belong to the caller.
 */
export async function listEmptyAssessments(
  db: DbClient,
  assessmentIds: string[],
): Promise<AssessmentContentSummary[]> {
  const summaries = await getAssessmentContentSummaries(db, assessmentIds);
  return summaries.filter((s) => !s.hasDeliverableContent);
}
