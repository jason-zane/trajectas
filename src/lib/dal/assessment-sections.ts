import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getItemsPerConstructForCount } from "@/app/actions/item-selection-rules";
import { getAssessmentContentSummaries } from "@/lib/dal/assessment-content";
import {
  selectItemsByDifficulty,
  type SelectableItem,
} from "@/lib/item-selection/distribution";
import { throwActionError } from "@/lib/security/action-errors";
import type { FormatGroup, SectionDraft } from "@/app/actions/assessments";

type DbClient = SupabaseClient;

/**
 * Section building for assessments: expand the selected factors to their
 * constructs, pick items under the item-selection rules, and materialise them
 * into assessment_sections / assessment_section_items — the only structure the
 * participant runner serves. Shared by the manual builder actions, the AI
 * architect, and the auto-build-on-activation path so every route to a live
 * assessment prints the same "exam paper" from the same taxonomy.
 */

// Section copy defaults — mirrors the manual builder's section-configurator so
// auto-built sections read identically to hand-built ones.
const DEFAULT_SECTION_TITLES: Record<string, string> = {
  likert: "Self-Report Questionnaire",
  binary: "Quick Checks",
  sjt: "Situational Judgement",
  forced_choice: "Forced Choice",
  free_text: "Open Response",
};

const DEFAULT_SECTION_INSTRUCTIONS: Record<string, string> = {
  likert: "Rate how strongly you agree or disagree with each statement.",
  binary: "Indicate whether each statement applies to you.",
  sjt: "Read each scenario carefully and rate the effectiveness of each response option.",
  forced_choice:
    "For each group of statements, select the one most like you and the one least like you.",
  free_text: "Please provide a detailed response to each prompt.",
};

/**
 * One default section per response format, in item-count order.
 * assessment_sections.title is NOT NULL and persistSections stores
 * `title.trim() || null`, so a non-empty default title is required.
 */
export function buildDefaultSectionDrafts(groups: FormatGroup[]): SectionDraft[] {
  return groups.map((g, i) => ({
    responseFormatId: g.responseFormatId,
    formatName: g.formatName,
    formatType: g.formatType,
    title: DEFAULT_SECTION_TITLES[g.formatType] ?? "Assessment Section",
    instructions: DEFAULT_SECTION_INSTRUCTIONS[g.formatType] ?? "",
    displayOrder: i,
    itemOrdering: g.formatType === "sjt" ? "fixed" : "randomised",
    timeLimitSeconds: null,
    itemCount: g.itemCount,
  }));
}

/**
 * Apply per-construct item limit by spreading the picks evenly across the
 * easy/medium/hard difficulty bands and meeting a 25 % reverse-coded floor.
 * Returns all items unchanged when no limit is set.
 */
export function applyPerConstructLimit<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Record<string, any> & SelectableItem & { construct_id: string },
>(items: T[], limit: number | null): T[] {
  if (limit === null) return items;

  const byConstruct = new Map<string, T[]>();
  for (const item of items) {
    const group = byConstruct.get(item.construct_id);
    if (group) group.push(item);
    else byConstruct.set(item.construct_id, [item]);
  }

  const result: T[] = [];
  for (const [, group] of byConstruct) {
    result.push(...selectItemsByDifficulty(group, limit));
  }
  return result;
}

/**
 * Resolve the response-format breakdown for a factor/construct scope: which
 * formats the rule-limited item pool spans and how many items land in each.
 * Pure query — authorization is owned by the calling action.
 */
export async function getFormatBreakdownForScope(
  db: DbClient,
  scope: { factorIds?: string[]; constructIds?: string[] },
): Promise<FormatGroup[]> {
  const factorIds = scope.factorIds ?? [];
  const directConstructIds = scope.constructIds ?? [];

  if (factorIds.length === 0 && directConstructIds.length === 0) return [];

  let constructIds: string[];
  if (directConstructIds.length > 0) {
    constructIds = [...new Set(directConstructIds)];
  } else {
    const { data: links } = await db
      .from("factor_constructs")
      .select("construct_id")
      .in("factor_id", factorIds);
    constructIds = [...new Set((links ?? []).map((l) => l.construct_id as string))];
  }
  if (constructIds.length === 0) return [];

  const limit = await getItemsPerConstructForCount(constructIds.length);

  const { data: items } = await db
    .from("items")
    .select(
      "id, construct_id, response_format_id, display_order, difficulty, reverse_scored, response_formats(id, name, type)",
    )
    .in("construct_id", constructIds)
    .eq("status", "active")
    .is("deleted_at", null);

  if (!items || items.length === 0) return [];

  const limitedItems = applyPerConstructLimit(items, limit);

  const groups = new Map<string, { formatName: string; formatType: string; count: number }>();

  for (const item of limitedItems) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rf = (item as any).response_formats;
    const fmtId = item.response_format_id;
    const existing = groups.get(fmtId);
    if (existing) {
      existing.count++;
    } else {
      groups.set(fmtId, {
        formatName: rf?.name ?? "Unknown",
        formatType: rf?.type ?? "unknown",
        count: 1,
      });
    }
  }

  return [...groups.entries()]
    .map(([responseFormatId, g]) => ({
      responseFormatId,
      formatName: g.formatName,
      formatType: g.formatType,
      itemCount: g.count,
    }))
    .sort((a, b) => b.itemCount - a.itemCount);
}

/**
 * Persist sections for an assessment and auto-assign matching items.
 * Items are matched to sections by response_format_id.
 * Returns an error message string, or null on success.
 */
export async function persistSections(
  db: DbClient,
  assessmentId: string,
  sections: SectionDraft[],
  scope: { factorIds: string[]; constructIds?: string[] },
): Promise<string | null> {
  const sectionInserts = sections.map((s) => ({
    assessment_id: assessmentId,
    response_format_id: s.responseFormatId,
    title: s.title.trim() || null,
    instructions: s.instructions || null,
    display_order: s.displayOrder,
    item_ordering: s.itemOrdering,
    time_limit_seconds: s.timeLimitSeconds ?? null,
  }));

  const { data: insertedSections, error: secErr } = await db
    .from("assessment_sections")
    .insert(sectionInserts)
    .select("id, response_format_id");

  if (secErr) return secErr.message;

  // Resolve construct IDs: prefer direct construct scope; otherwise expand factors.
  let constructIds: string[];
  if (scope.constructIds && scope.constructIds.length > 0) {
    constructIds = [...new Set(scope.constructIds)];
  } else {
    const { data: links } = await db
      .from("factor_constructs")
      .select("construct_id")
      .in("factor_id", scope.factorIds);
    constructIds = [
      ...new Set(((links ?? []) as { construct_id: string }[]).map((l) => l.construct_id)),
    ];
  }
  if (constructIds.length === 0) return null;

  const limit = await getItemsPerConstructForCount(constructIds.length);

  const { data: items } = await db
    .from("items")
    .select("id, construct_id, response_format_id, display_order, difficulty, reverse_scored")
    .in("construct_id", constructIds)
    .eq("status", "active")
    .is("deleted_at", null);

  if (!items || items.length === 0) return null;

  const limitedItems = applyPerConstructLimit(items, limit);

  const sectionByFormat = new Map<string, string>();
  for (const s of insertedSections ?? []) {
    sectionByFormat.set(s.response_format_id, s.id);
  }

  const sectionItems: { section_id: string; item_id: string; display_order: number }[] = [];
  const orderBySection = new Map<string, number>();

  for (const item of limitedItems) {
    const sectionId = sectionByFormat.get(item.response_format_id);
    if (!sectionId) continue;

    const order = orderBySection.get(sectionId) ?? 0;
    sectionItems.push({
      section_id: sectionId,
      item_id: item.id,
      display_order: order,
    });
    orderBySection.set(sectionId, order + 1);
  }

  if (sectionItems.length > 0) {
    const { error: itemErr } = await db.from("assessment_section_items").insert(sectionItems);
    if (itemErr) return itemErr.message;
  }

  return null;
}

export type AutoBuildResult = {
  built: boolean;
  itemCount: number;
};

/**
 * Materialise the default section layout from an assessment's selected
 * factors, so activation doesn't require a separate Presentation-step save.
 * No-ops (built: false) when:
 * - the assessment is missing, deleted, or forced-choice mode (no serving path);
 * - sections already exist (never clobber a configured layout);
 * - no factors are selected, or they resolve to zero active items.
 * Throws on infrastructure errors — callers fail closed.
 */
export async function autoBuildSectionsFromFactors(
  db: DbClient,
  assessmentId: string,
): Promise<AutoBuildResult> {
  const none: AutoBuildResult = { built: false, itemCount: 0 };

  const { data: assessment, error: assessmentErr } = await db
    .from("assessments")
    .select("format_mode")
    .eq("id", assessmentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (assessmentErr) {
    throwActionError(
      "autoBuildSectionsFromFactors.assessment",
      "Unable to build assessment sections.",
      assessmentErr,
    );
  }
  if (!assessment || assessment.format_mode === "forced_choice") return none;

  const { count: sectionCount, error: sectionErr } = await db
    .from("assessment_sections")
    .select("id", { count: "exact", head: true })
    .eq("assessment_id", assessmentId);

  if (sectionErr) {
    throwActionError(
      "autoBuildSectionsFromFactors.sections",
      "Unable to build assessment sections.",
      sectionErr,
    );
  }
  if (sectionCount && sectionCount > 0) return none;

  const { data: factorLinks, error: factorErr } = await db
    .from("assessment_factors")
    .select("factor_id")
    .eq("assessment_id", assessmentId);

  if (factorErr) {
    throwActionError(
      "autoBuildSectionsFromFactors.factors",
      "Unable to build assessment sections.",
      factorErr,
    );
  }
  const factorIds = ((factorLinks ?? []) as { factor_id: string }[]).map((l) => l.factor_id);
  if (factorIds.length === 0) return none;

  const groups = await getFormatBreakdownForScope(db, { factorIds });
  if (groups.length === 0) return none;

  const drafts = buildDefaultSectionDrafts(groups);
  const persistErr = await persistSections(db, assessmentId, drafts, { factorIds });
  if (persistErr) {
    throwActionError(
      "autoBuildSectionsFromFactors.persist",
      "Unable to build assessment sections.",
      new Error(persistErr),
    );
  }

  const [summary] = await getAssessmentContentSummaries(db, [assessmentId]);
  const itemCount = summary?.itemCount ?? 0;
  return { built: itemCount > 0, itemCount };
}
