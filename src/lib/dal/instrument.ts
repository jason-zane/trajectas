import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logActionError, throwActionError } from "@/lib/security/action-errors";
import { isSupersededBy } from "@/lib/instrument/evidence";
import type { BlueprintCell } from "@/lib/instrument/types";
import {
  mapInstrumentBuildRow,
  mapInstrumentBuildRows,
  mapInstrumentBlueprintCellRows,
  mapInstrumentBlueprintRow,
  mapInstrumentBlueprintRows,
  mapInstrumentCandidateItemRow,
  mapInstrumentCandidateItemRows,
  mapInstrumentEvidenceRows,
  mapInstrumentStageRunRow,
  mapInstrumentStageRunRows,
  type InstrumentBuildDto,
  type InstrumentBlueprintDto,
  type InstrumentCandidateItemDto,
  type InstrumentStageRunDto,
  type EvidenceRecordDto,
  type DbRow,
} from "@/lib/dal/instrument-mappers";

/**
 * Data Access Layer for the instrument builder engine.
 *
 * Each function owns a query and returns a DTO; the calling Server Action owns
 * authorization and passes the resolved scope down. The Supabase client is
 * injected so the caller decides the trust boundary (RLS vs admin).
 * See src/lib/dal/README.md.
 */

type DbClient = SupabaseClient;

// ============================================================================
// instrument_builds queries
// ============================================================================

/**
 * List non-deleted instrument builds (newest first).
 * Throws via throwActionError on query failure.
 */
export async function listBuilds(db: DbClient): Promise<InstrumentBuildDto[]> {
  const { data, error } = await db
    .from("instrument_builds")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throwActionError("listBuilds", "Unable to load instrument builds.", error);
  }

  return mapInstrumentBuildRows(data ?? []);
}

/**
 * Fetch a single build by id. Returns null if not found or soft-deleted.
 */
export async function getBuild(
  db: DbClient,
  buildId: string,
): Promise<InstrumentBuildDto | null> {
  const { data: row, error } = await db
    .from("instrument_builds")
    .select("*")
    .eq("id", buildId)
    .is("deleted_at", null)
    .single();

  if (error || !row) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return mapInstrumentBuildRow(row as any);
}

/**
 * Create a new instrument build.
 */
export async function createBuild(
  db: DbClient,
  input: {
    name: string;
    status?: string;
    measureType: string;
    brief?: string | null;
    audience?: Record<string, unknown> | null;
    useContext?: string | null;
    targetConstructCount?: number | null;
    targetItemsPerConstruct?: number | null;
    config?: Record<string, unknown> | null;
    presetId?: string | null;
    createdBy?: string | null;
  },
): Promise<InstrumentBuildDto> {
  const { data, error } = await db
    .from("instrument_builds")
    .insert({
      name: input.name,
      status: input.status ?? "draft",
      measure_type: input.measureType,
      brief: input.brief,
      audience: input.audience ?? {},
      use_context: input.useContext,
      target_construct_count: input.targetConstructCount,
      target_items_per_construct: input.targetItemsPerConstruct,
      config: input.config ?? {},
      preset_id: input.presetId,
      created_by: input.createdBy,
    })
    .select("*")
    .single();

  if (error) {
    throwActionError(
      "createBuild",
      "Unable to create instrument build.",
      error,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return mapInstrumentBuildRow(data as any);
}

/**
 * Update a build by id (partial patch). Returns the updated build.
 * Throws if not found.
 */
export async function updateBuild(
  db: DbClient,
  buildId: string,
  patch: Partial<{
    name: string;
    status: string;
    brief: string | null;
    audience: Record<string, unknown> | null;
    useContext: string | null;
    targetConstructCount: number | null;
    targetItemsPerConstruct: number | null;
    config: Record<string, unknown> | null;
    presetId: string | null;
  }>,
): Promise<InstrumentBuildDto> {
  const updates: Record<string, unknown> = {};
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.status !== undefined) updates.status = patch.status;
  if (patch.brief !== undefined) updates.brief = patch.brief;
  if (patch.audience !== undefined) updates.audience = patch.audience;
  if (patch.useContext !== undefined) updates.use_context = patch.useContext;
  if (patch.targetConstructCount !== undefined)
    updates.target_construct_count = patch.targetConstructCount;
  if (patch.targetItemsPerConstruct !== undefined)
    updates.target_items_per_construct = patch.targetItemsPerConstruct;
  if (patch.config !== undefined) updates.config = patch.config;
  if (patch.presetId !== undefined) updates.preset_id = patch.presetId;

  const { data, error } = await db
    .from("instrument_builds")
    .update(updates)
    .eq("id", buildId)
    .is("deleted_at", null)
    .select("*")
    .single();

  if (error) {
    throwActionError(
      "updateBuild",
      "Unable to update instrument build.",
      error,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return mapInstrumentBuildRow(data as any);
}

/**
 * Soft-delete a build by setting deleted_at.
 */
export async function softDeleteBuild(
  db: DbClient,
  buildId: string,
): Promise<void> {
  const { error } = await db
    .from("instrument_builds")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", buildId);

  if (error) {
    throwActionError(
      "softDeleteBuild",
      "Unable to delete instrument build.",
      error,
    );
  }
}

// ============================================================================
// instrument_blueprints queries
// ============================================================================

/**
 * List non-deleted blueprints for a build (oldest first).
 */
export async function listBlueprints(
  db: DbClient,
  buildId: string,
): Promise<InstrumentBlueprintDto[]> {
  const { data, error } = await db
    .from("instrument_blueprints")
    .select("*")
    .eq("build_id", buildId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    throwActionError("listBlueprints", "Unable to load blueprints.", error);
  }

  return mapInstrumentBlueprintRows(data ?? []);
}

/**
 * Fetch a blueprint with its cells.
 * Returns null if blueprint not found or soft-deleted.
 */
export async function getBlueprintWithCells(
  db: DbClient,
  blueprintId: string,
): Promise<{
  blueprint: InstrumentBlueprintDto;
  cells: BlueprintCell[];
} | null> {
  const { data: blueprintRow, error: bpError } = await db
    .from("instrument_blueprints")
    .select("*")
    .eq("id", blueprintId)
    .is("deleted_at", null)
    .single();

  if (bpError || !blueprintRow) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blueprint = mapInstrumentBlueprintRow(blueprintRow as any);

  const { data: cellRows, error: cellError } = await db
    .from("instrument_blueprint_cells")
    .select("*")
    .eq("blueprint_id", blueprintId)
    .order("display_order", { ascending: true });

  if (cellError) {
    logActionError("getBlueprintWithCells (cells)", cellError);
  }

  const cells = mapInstrumentBlueprintCellRows(cellRows ?? []);

  return { blueprint, cells };
}

/**
 * Create a new blueprint.
 */
export async function createBlueprint(
  db: DbClient,
  input: {
    buildId: string;
    constructId?: string | null;
    draftConstructName?: string | null;
    draftConstructDefinition?: string | null;
    measureType: string;
    targetAlpha?: number | null;
    exclusions?: string[] | null;
    notes?: string | null;
    status?: string;
  },
): Promise<InstrumentBlueprintDto> {
  const { data, error } = await db
    .from("instrument_blueprints")
    .insert({
      build_id: input.buildId,
      construct_id: input.constructId,
      draft_construct_name: input.draftConstructName,
      draft_construct_definition: input.draftConstructDefinition,
      measure_type: input.measureType,
      target_alpha: input.targetAlpha,
      exclusions: input.exclusions,
      notes: input.notes,
      status: input.status ?? "draft",
    })
    .select("*")
    .single();

  if (error) {
    throwActionError("createBlueprint", "Unable to create blueprint.", error);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return mapInstrumentBlueprintRow(data as any);
}

/**
 * Update a blueprint by id (partial patch).
 */
export async function updateBlueprint(
  db: DbClient,
  blueprintId: string,
  patch: Partial<{
    constructId: string | null;
    draftConstructName: string | null;
    draftConstructDefinition: string | null;
    targetAlpha: number | null;
    exclusions: string[] | null;
    notes: string | null;
    status: string;
  }>,
): Promise<InstrumentBlueprintDto> {
  const updates: Record<string, unknown> = {};
  if (patch.constructId !== undefined) updates.construct_id = patch.constructId;
  if (patch.draftConstructName !== undefined)
    updates.draft_construct_name = patch.draftConstructName;
  if (patch.draftConstructDefinition !== undefined)
    updates.draft_construct_definition = patch.draftConstructDefinition;
  if (patch.targetAlpha !== undefined) updates.target_alpha = patch.targetAlpha;
  if (patch.exclusions !== undefined) updates.exclusions = patch.exclusions;
  if (patch.notes !== undefined) updates.notes = patch.notes;
  if (patch.status !== undefined) updates.status = patch.status;

  const { data, error } = await db
    .from("instrument_blueprints")
    .update(updates)
    .eq("id", blueprintId)
    .is("deleted_at", null)
    .select("*")
    .single();

  if (error) {
    throwActionError("updateBlueprint", "Unable to update blueprint.", error);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return mapInstrumentBlueprintRow(data as any);
}

/**
 * Soft-delete a blueprint by setting deleted_at.
 */
export async function softDeleteBlueprint(
  db: DbClient,
  blueprintId: string,
): Promise<void> {
  const { error } = await db
    .from("instrument_blueprints")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", blueprintId);

  if (error) {
    throwActionError(
      "softDeleteBlueprint",
      "Unable to delete blueprint.",
      error,
    );
  }
}

// ============================================================================
// instrument_blueprint_cells queries
// ============================================================================

/**
 * Replace all cells in a blueprint with a new set.
 * Deletes existing cells (which cascade-delete candidate items),
 * then inserts new ones, preserving display_order.
 */
export async function replaceBlueprintCells(
  db: DbClient,
  blueprintId: string,
  cells: Array<Omit<BlueprintCell, "id"> & { facetDefinition?: string | null }>,
): Promise<BlueprintCell[]> {
  // Upsert on the natural key rather than delete-all-then-reinsert.
  //
  // instrument_candidate_items.blueprint_cell_id is ON DELETE SET NULL, so
  // dropping every row would orphan every generated item and wipe the coverage
  // audit the moment an admin pressed Save. Upserting keeps the id — and
  // therefore the item associations — for any (facet, intensity) that survives
  // the edit; only genuinely removed cells are deleted.
  if (cells.length > 0) {
    const rowsToUpsert = cells.map((cell) => ({
      blueprint_id: blueprintId,
      facet_label: cell.facetLabel,
      facet_definition: cell.facetDefinition ?? null,
      intensity: cell.intensity,
      target_item_count: cell.targetItemCount,
      display_order: cell.displayOrder,
    }));

    const { error: upsertError } = await db
      .from("instrument_blueprint_cells")
      .upsert(rowsToUpsert, {
        onConflict: "blueprint_id,facet_label,intensity",
      });

    if (upsertError) {
      throwActionError(
        "replaceBlueprintCells (upsert)",
        "Unable to save blueprint cells.",
        upsertError,
      );
    }
  }

  // Remove only the cells the caller no longer lists. Items attached to those
  // cells are intentionally detached — the facet they measured is gone.
  const { data: existing, error: readError } = await db
    .from("instrument_blueprint_cells")
    .select("id, facet_label, intensity")
    .eq("blueprint_id", blueprintId);

  if (readError) {
    throwActionError(
      "replaceBlueprintCells (read)",
      "Unable to read blueprint cells.",
      readError,
    );
  }

  const keep = new Set(cells.map((c) => `${c.facetLabel}\u0000${c.intensity}`));
  const staleIds = (existing ?? [])
    .filter((row) => {
      const r = row as DbRow;
      return !keep.has(`${String(r.facet_label)}\u0000${String(r.intensity)}`);
    })
    .map((row) => (row as DbRow).id as string);

  if (staleIds.length > 0) {
    const { error: delError } = await db
      .from("instrument_blueprint_cells")
      .delete()
      .in("id", staleIds);

    if (delError) {
      throwActionError(
        "replaceBlueprintCells (delete)",
        "Unable to remove deleted cells.",
        delError,
      );
    }
  }

  const { data, error: finalError } = await db
    .from("instrument_blueprint_cells")
    .select("*")
    .eq("blueprint_id", blueprintId)
    .order("display_order", { ascending: true });

  if (finalError) {
    throwActionError(
      "replaceBlueprintCells (reload)",
      "Unable to reload blueprint cells.",
      finalError,
    );
  }

  return mapInstrumentBlueprintCellRows(data ?? []);
}

// ============================================================================
// instrument_candidate_items queries
// ============================================================================

/**
 * Create a candidate item.
 */
export async function createCandidateItem(
  db: DbClient,
  input: {
    buildId: string;
    blueprintCellId?: string | null;
    stem: string;
    stemObserver?: string | null;
    reverseScored?: boolean;
    rationale?: string | null;
    facet?: string | null;
    difficultyTier?: string | null;
    sdRisk?: string | null;
    sdRating?: number | null;
    readingGrade?: number | null;
    payload?: Record<string, unknown> | null;
    status?: string;
    publishedItemId?: string | null;
  },
): Promise<InstrumentCandidateItemDto> {
  const { data, error } = await db
    .from("instrument_candidate_items")
    .insert({
      build_id: input.buildId,
      blueprint_cell_id: input.blueprintCellId,
      stem: input.stem,
      stem_observer: input.stemObserver,
      reverse_scored: input.reverseScored,
      rationale: input.rationale,
      facet: input.facet,
      difficulty_tier: input.difficultyTier,
      sd_risk: input.sdRisk,
      sd_rating: input.sdRating,
      reading_grade: input.readingGrade,
      payload: input.payload,
      status: input.status ?? "candidate",
      published_item_id: input.publishedItemId,
    })
    .select("*")
    .single();

  if (error) {
    throwActionError(
      "createCandidateItem",
      "Unable to create candidate item.",
      error,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return mapInstrumentCandidateItemRow(data as any);
}

/**
 * Fetch a candidate item by id. Returns null if not found or soft-deleted.
 */
export async function getCandidateItem(
  db: DbClient,
  itemId: string,
): Promise<InstrumentCandidateItemDto | null> {
  const { data: row, error } = await db
    .from("instrument_candidate_items")
    .select("*")
    .eq("id", itemId)
    .is("deleted_at", null)
    .single();

  if (error || !row) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return mapInstrumentCandidateItemRow(row as any);
}

/**
 * List candidate items for a build.
 */
export async function listCandidateItems(
  db: DbClient,
  buildId: string,
): Promise<InstrumentCandidateItemDto[]> {
  const { data, error } = await db
    .from("instrument_candidate_items")
    .select("*")
    .eq("build_id", buildId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throwActionError(
      "listCandidateItems",
      "Unable to load candidate items.",
      error,
    );
  }

  return mapInstrumentCandidateItemRows(data ?? []);
}

/**
 * Update a candidate item.
 */
export async function updateCandidateItem(
  db: DbClient,
  itemId: string,
  patch: Partial<{
    blueprintCellId: string | null;
    stem: string;
    stemObserver: string | null;
    reverseScored: boolean;
    rationale: string | null;
    facet: string | null;
    difficultyTier: string | null;
    sdRisk: string | null;
    sdRating: number | null;
    readingGrade: number | null;
    payload: Record<string, unknown> | null;
    status: string;
    publishedItemId: string | null;
  }>,
): Promise<InstrumentCandidateItemDto> {
  const updates: Record<string, unknown> = {};
  if (patch.blueprintCellId !== undefined)
    updates.blueprint_cell_id = patch.blueprintCellId;
  if (patch.stem !== undefined) updates.stem = patch.stem;
  if (patch.stemObserver !== undefined)
    updates.stem_observer = patch.stemObserver;
  if (patch.reverseScored !== undefined)
    updates.reverse_scored = patch.reverseScored;
  if (patch.rationale !== undefined) updates.rationale = patch.rationale;
  if (patch.facet !== undefined) updates.facet = patch.facet;
  if (patch.difficultyTier !== undefined)
    updates.difficulty_tier = patch.difficultyTier;
  if (patch.sdRisk !== undefined) updates.sd_risk = patch.sdRisk;
  if (patch.sdRating !== undefined) updates.sd_rating = patch.sdRating;
  if (patch.readingGrade !== undefined)
    updates.reading_grade = patch.readingGrade;
  if (patch.payload !== undefined) updates.payload = patch.payload;
  if (patch.status !== undefined) updates.status = patch.status;
  if (patch.publishedItemId !== undefined)
    updates.published_item_id = patch.publishedItemId;

  const { data, error } = await db
    .from("instrument_candidate_items")
    .update(updates)
    .eq("id", itemId)
    .is("deleted_at", null)
    .select("*")
    .single();

  if (error) {
    throwActionError(
      "updateCandidateItem",
      "Unable to update candidate item.",
      error,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return mapInstrumentCandidateItemRow(data as any);
}

/**
 * Soft-delete a candidate item.
 */
export async function softDeleteCandidateItem(
  db: DbClient,
  itemId: string,
): Promise<void> {
  const { error } = await db
    .from("instrument_candidate_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", itemId);

  if (error) {
    throwActionError(
      "softDeleteCandidateItem",
      "Unable to delete candidate item.",
      error,
    );
  }
}

// ============================================================================
// instrument_stage_runs queries
// ============================================================================

/**
 * Record a stage run. Creates a new row with the given input.
 */
export async function recordStageRun(
  db: DbClient,
  input: {
    buildId: string;
    stageKey: string;
    status: "pending" | "running" | "success" | "failure" | "paused";
    severity?: string | null;
    progressPct?: number | null;
    detail?: string | null;
    inputSnapshot?: Record<string, unknown> | null;
    outputSnapshot?: Record<string, unknown> | null;
    tokenUsage?: Record<string, unknown> | null;
    errorMessage?: string | null;
    startedAt?: string | null;
    completedAt?: string | null;
  },
): Promise<InstrumentStageRunDto> {
  const { data, error } = await db
    .from("instrument_stage_runs")
    .insert({
      build_id: input.buildId,
      stage_key: input.stageKey,
      status: input.status,
      severity: input.severity,
      progress_pct: input.progressPct,
      detail: input.detail,
      input_snapshot: input.inputSnapshot,
      output_snapshot: input.outputSnapshot,
      token_usage: input.tokenUsage,
      error_message: input.errorMessage,
      started_at: input.startedAt,
      completed_at: input.completedAt,
    })
    .select("*")
    .single();

  if (error) {
    throwActionError("recordStageRun", "Unable to record stage run.", error);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return mapInstrumentStageRunRow(data as any);
}

/**
 * List stage runs for a build, newest first.
 */
export async function listStageRuns(
  db: DbClient,
  buildId: string,
): Promise<InstrumentStageRunDto[]> {
  const { data, error } = await db
    .from("instrument_stage_runs")
    .select("*")
    .eq("build_id", buildId)
    .order("created_at", { ascending: false });

  if (error) {
    throwActionError("listStageRuns", "Unable to load stage runs.", error);
  }

  return mapInstrumentStageRunRows(data ?? []);
}

// ============================================================================
// instrument_evidence queries
// ============================================================================

/**
 * Append evidence records, handling supersession.
 *
 * For each incoming record, checks if it supersedes any existing (live)
 * record with the same (targetType, targetId, claim) using the
 * isSupersededBy() rule from src/lib/instrument/evidence.ts.
 * If so, marks the old record's superseded_by column.
 *
 * Then inserts all incoming records.
 */
export async function appendEvidence(
  db: DbClient,
  buildId: string,
  records: Omit<EvidenceRecordDto, "id">[],
): Promise<EvidenceRecordDto[]> {
  if (records.length === 0) {
    return [];
  }

  // Build a map of (targetType, targetId, claim) -> incoming record
  const incomingByKey = new Map<string, Omit<EvidenceRecordDto, "id">>();
  for (const rec of records) {
    const key = `${rec.targetType}|${rec.targetId}|${rec.claim}`;
    incomingByKey.set(key, rec);
  }

  // Fetch all live (non-superseded) evidence for the same claims
  const targetKeys = Array.from(incomingByKey.keys());
  const existingRecords: EvidenceRecordDto[] = [];

  for (const key of targetKeys) {
    const [targetType, targetId, claim] = key.split("|");
    const { data, error } = await db
      .from("instrument_evidence")
      .select("*")
      .eq("build_id", buildId)
      .eq("target_type", targetType)
      .eq("target_id", targetId)
      .eq("claim", claim)
      .is("superseded_by", null);

    if (!error && data) {
      existingRecords.push(...mapInstrumentEvidenceRows(data as DbRow[]));
    }
  }

  // Determine which existing records to supersede
  const toSupersede = new Map<string, string>(); // existingId -> marked for supersession

  for (const key of targetKeys) {
    const incoming = incomingByKey.get(key)!;
    for (const existing of existingRecords) {
      if (
        existing.targetType === incoming.targetType &&
        existing.targetId === incoming.targetId &&
        existing.claim === incoming.claim
      ) {
        // `incoming` has no id yet; give it a placeholder so both sides satisfy
        // EvidenceRecord. isSupersededBy only reads target/claim/class/producedAt.
        if (isSupersededBy(existing, { ...incoming, id: "" })) {
          toSupersede.set(existing.id, "__mark__");
        }
      }
    }
  }

  // Insert the new records
  const rowsToInsert = records.map((rec) => ({
    build_id: buildId,
    target_type: rec.targetType,
    target_id: rec.targetId,
    claim: rec.claim,
    value: rec.value,
    interval_low: rec.interval?.[0] ?? null,
    interval_high: rec.interval?.[1] ?? null,
    evidence_class: rec.evidenceClass,
    method: rec.method,
    sample_size: rec.sampleSize ?? rec.detail?.n ?? null,
  }));

  const { data: insertedRows, error: insError } = await db
    .from("instrument_evidence")
    .insert(rowsToInsert)
    .select("*");

  if (insError) {
    throwActionError(
      "appendEvidence (insert)",
      "Unable to insert evidence records.",
      insError,
    );
  }

  const insertedData = insertedRows ?? [];
  const newIds = insertedData.map((r) => (r as DbRow).id as string);

  // Update superseded records to point to the new id
  if (toSupersede.size > 0 && newIds.length > 0) {
    const supersededIds = Array.from(toSupersede.keys());
    const firstNewId = newIds[0];

    const { error: updateError } = await db
      .from("instrument_evidence")
      .update({ superseded_by: firstNewId })
      .in("id", supersededIds);

    if (updateError) {
      logActionError("appendEvidence (update superseded)", updateError);
    }
  }

  return mapInstrumentEvidenceRows(insertedData);
}

/**
 * List evidence for a build.
 */
export async function listEvidence(
  db: DbClient,
  buildId: string,
): Promise<EvidenceRecordDto[]> {
  const { data, error } = await db
    .from("instrument_evidence")
    .select("*")
    .eq("build_id", buildId)
    .order("created_at", { ascending: false });

  if (error) {
    throwActionError("listEvidence", "Unable to load evidence.", error);
  }

  return mapInstrumentEvidenceRows(data ?? []);
}

// ============================================================================
// Bulk candidate item creation & blueprint-scoped queries
// ============================================================================

/**
 * Bulk-create candidate items. Returns the inserted rows as DTOs.
 * Returns [] without a database call if items array is empty.
 * Throws via throwActionError on query failure.
 */
export async function createCandidateItems(
  db: DbClient,
  buildId: string,
  items: Array<{
    blueprintCellId?: string | null;
    stem: string;
    facet?: string | null;
    reverseScored?: boolean;
    rationale?: string | null;
    difficultyTier?: string | null;
    sdRisk?: string | null;
  }>,
): Promise<InstrumentCandidateItemDto[]> {
  if (items.length === 0) {
    return [];
  }

  const rowsToInsert = items.map((item) => ({
    build_id: buildId,
    blueprint_cell_id: item.blueprintCellId,
    stem: item.stem,
    reverse_scored: item.reverseScored,
    rationale: item.rationale,
    facet: item.facet,
    difficulty_tier: item.difficultyTier,
    sd_risk: item.sdRisk,
    status: "candidate",
  }));

  const { data, error } = await db
    .from("instrument_candidate_items")
    .insert(rowsToInsert)
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    throwActionError(
      "createCandidateItems",
      "Unable to create candidate items.",
      error,
    );
  }

  return mapInstrumentCandidateItemRows(data ?? []);
}

/**
 * List candidate items whose blueprint_cell_id belongs to a given blueprint,
 * excluding soft-deleted, ordered by created_at.
 */
export async function listCandidateItemsByBlueprint(
  db: DbClient,
  blueprintId: string,
): Promise<InstrumentCandidateItemDto[]> {
  // First, get all cell IDs for this blueprint
  const { data: cellRows, error: cellError } = await db
    .from("instrument_blueprint_cells")
    .select("id")
    .eq("blueprint_id", blueprintId);

  if (cellError) {
    throwActionError(
      "listCandidateItemsByBlueprint (cells)",
      "Unable to load blueprint cells.",
      cellError,
    );
  }

  const cellIds = (cellRows ?? []).map((r) => (r as DbRow).id as string);

  // If no cells, return empty array
  if (cellIds.length === 0) {
    return [];
  }

  // Query candidate items for these cells
  const { data, error } = await db
    .from("instrument_candidate_items")
    .select("*")
    .in("blueprint_cell_id", cellIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    throwActionError(
      "listCandidateItemsByBlueprint (items)",
      "Unable to load candidate items for blueprint.",
      error,
    );
  }

  return mapInstrumentCandidateItemRows(data ?? []);
}

/**
 * List all candidate items for a build (any status except soft-deleted).
 */
export async function listCandidateItemsForBuild(
  db: DbClient,
  buildId: string,
): Promise<InstrumentCandidateItemDto[]> {
  const { data, error } = await db
    .from("instrument_candidate_items")
    .select("*")
    .eq("build_id", buildId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    throwActionError(
      "listCandidateItemsForBuild",
      "Unable to load candidate items for build.",
      error,
    );
  }

  return mapInstrumentCandidateItemRows(data ?? []);
}

// ============================================================================
// instrument_congruence_ratings queries
// ============================================================================

/**
 * Bulk-insert congruence ratings. Returns the count of inserted rows.
 * Returns 0 without a database call if rows array is empty.
 * Throws via throwActionError on query failure.
 */
export async function insertCongruenceRatings(
  db: DbClient,
  rows: Array<{
    candidateItemId: string;
    raterIndex: number;
    raterModel: string;
    assignedBlueprintId: string | null;
    intendedBlueprintId: string;
    relevance: number;
    namedFacet?: string | null;
    rationale?: string | null;
  }>,
): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }

  const rowsToInsert = rows.map((row) => ({
    candidate_item_id: row.candidateItemId,
    rater_index: row.raterIndex,
    rater_model: row.raterModel,
    assigned_blueprint_id: row.assignedBlueprintId,
    intended_blueprint_id: row.intendedBlueprintId,
    relevance: row.relevance,
    named_facet: row.namedFacet ?? null,
    rationale: row.rationale ?? null,
  }));

  const { data, error } = await db
    .from("instrument_congruence_ratings")
    .insert(rowsToInsert)
    .select("id");

  if (error) {
    throwActionError(
      "insertCongruenceRatings",
      "Unable to insert congruence ratings.",
      error,
    );
  }

  return (data ?? []).length;
}

/**
 * List congruence ratings for a build.
 * Joins through instrument_candidate_items to filter by build_id,
 * excluding soft-deleted items.
 */
export async function listCongruenceRatingsForBuild(
  db: DbClient,
  buildId: string,
): Promise<
  Array<{
    candidateItemId: string;
    raterIndex: number;
    raterModel: string;
    assignedBlueprintId: string | null;
    intendedBlueprintId: string;
    relevance: number;
    namedFacet?: string | null;
  }>
> {
  const { data, error } = await db
    .from("instrument_congruence_ratings")
    .select(
      `id, candidate_item_id, rater_index, rater_model,
       assigned_blueprint_id, intended_blueprint_id, relevance, named_facet,
       instrument_candidate_items!inner(build_id)`,
    )
    .eq("instrument_candidate_items.build_id", buildId)
    .is("instrument_candidate_items.deleted_at", null);

  if (error) {
    throwActionError(
      "listCongruenceRatingsForBuild",
      "Unable to load congruence ratings.",
      error,
    );
  }

  const ratings: Array<{
    candidateItemId: string;
    raterIndex: number;
    raterModel: string;
    assignedBlueprintId: string | null;
    intendedBlueprintId: string;
    relevance: number;
    namedFacet?: string | null;
  }> = [];

  for (const row of data ?? []) {
    const r = row as DbRow;
    const rating: (typeof ratings)[number] = {
      candidateItemId: String(r.candidate_item_id),
      raterIndex: Number(r.rater_index),
      raterModel: String(r.rater_model),
      assignedBlueprintId:
        typeof r.assigned_blueprint_id === "string"
          ? r.assigned_blueprint_id
          : null,
      intendedBlueprintId: String(r.intended_blueprint_id),
      relevance: Number(r.relevance),
    };
    if (r.named_facet) {
      rating.namedFacet = String(r.named_facet);
    }
    ratings.push(rating);
  }

  return ratings;
}

/**
 * Update a candidate item's fairness data.
 * Patches reading_grade and updates payload with fairness flags.
 */
export async function updateCandidateItemFairness(
  db: DbClient,
  itemId: string,
  patch: Partial<{
    readingGrade: number | null;
    payload: Record<string, unknown> | null;
  }>,
): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (patch.readingGrade !== undefined) updates.reading_grade = patch.readingGrade;
  if (patch.payload !== undefined) updates.payload = patch.payload;

  if (Object.keys(updates).length === 0) {
    return;
  }

  const { error } = await db
    .from("instrument_candidate_items")
    .update(updates)
    .eq("id", itemId)
    .is("deleted_at", null);

  if (error) {
    throwActionError(
      "updateCandidateItemFairness",
      "Unable to update candidate item fairness.",
      error,
    );
  }
}

/**
 * Find an in-flight stage run for a build, if one exists.
 *
 * Used as a concurrency guard: expensive generation stages write a `running`
 * row before doing any work, so a second invocation can refuse rather than
 * duplicate the first run's output.
 */
export async function findRunningStageRun(
  db: DbClient,
  buildId: string,
  stageKey: string,
): Promise<InstrumentStageRunDto | null> {
  const { data, error } = await db
    .from("instrument_stage_runs")
    .select("*")
    .eq("build_id", buildId)
    .eq("stage_key", stageKey)
    .eq("status", "running")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return null;

  return mapInstrumentStageRunRow(data[0] as DbRow);
}

/**
 * Patch an existing stage run — used to close out a `running` row.
 */
export async function updateStageRun(
  db: DbClient,
  stageRunId: string,
  patch: {
    status?: "pending" | "running" | "success" | "failure" | "paused";
    progressPct?: number | null;
    detail?: string | null;
    outputSnapshot?: Record<string, unknown> | null;
    tokenUsage?: Record<string, unknown> | null;
    errorMessage?: string | null;
    completedAt?: string | null;
  },
): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (patch.status !== undefined) updates.status = patch.status;
  if (patch.progressPct !== undefined) updates.progress_pct = patch.progressPct;
  if (patch.detail !== undefined) updates.detail = patch.detail;
  if (patch.outputSnapshot !== undefined) updates.output_snapshot = patch.outputSnapshot;
  if (patch.tokenUsage !== undefined) updates.token_usage = patch.tokenUsage;
  if (patch.errorMessage !== undefined) updates.error_message = patch.errorMessage;
  if (patch.completedAt !== undefined) updates.completed_at = patch.completedAt;

  const { error } = await db
    .from("instrument_stage_runs")
    .update(updates)
    .eq("id", stageRunId);

  if (error) {
    throwActionError("updateStageRun", "Unable to update stage run.", error);
  }
}

/**
 * Delete existing congruence ratings for a set of candidate items.
 *
 * A panel rerun must REPLACE its prior ratings, not append to them: appending
 * mixes two independent rating sets, inflates the apparent rater count, and
 * skews accuracy, Aiken's V and kappa toward whichever run happened to be
 * larger.
 */
export async function deleteCongruenceRatingsForItems(
  db: DbClient,
  candidateItemIds: string[],
): Promise<void> {
  if (candidateItemIds.length === 0) return;

  const { error } = await db
    .from("instrument_congruence_ratings")
    .delete()
    .in("candidate_item_id", candidateItemIds);

  if (error) {
    throwActionError(
      "deleteCongruenceRatingsForItems",
      "Unable to clear previous congruence ratings.",
      error,
    );
  }
}
