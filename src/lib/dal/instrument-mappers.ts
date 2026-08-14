/**
 * Pure row → DTO transforms for the instrument DAL.
 *
 * I/O-free (no Supabase, no `server-only`) so the mapping logic is unit-tested
 * and coverage-gated. Query functions in `instrument.ts` call these after
 * fetching rows. See src/lib/dal/README.md.
 */

import type {
  BlueprintCell,
  EvidenceClass,
  EvidenceRecord,
  Intensity,
} from "@/lib/instrument/types";
import { INTENSITIES } from "@/lib/instrument/types";

/**
 * A raw PostgREST row. Fields are `unknown` until narrowed by the coercion
 * helpers below — that is deliberate, so a schema drift shows up as a type
 * error here rather than as `undefined` leaking into the UI.
 */
export type DbRow = Record<string, unknown>;

/** Coerce NUMERIC postgres columns (which arrive as strings) to number. */
function numericToNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Required string column; empty string when absent. */
function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Optional string column; undefined when null/absent. */
function strOpt(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** Optional boolean column. */
function boolOpt(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

/** Optional JSON object column. */
function jsonOpt(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Optional text[] column. */
function strArrayOpt(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((v): v is string => typeof v === "string");
}

/** Narrow an intensity column to a known level, defaulting to 'mid'. */
function intensityOf(value: unknown): Intensity {
  return INTENSITIES.find((level) => level === value) ?? "mid";
}

// ============================================================================
// Build DTOs
// ============================================================================

export interface InstrumentBuildDto {
  id: string;
  name: string;
  status: string;
  measureType: string;
  brief?: string | null;
  audience?: Record<string, unknown> | null;
  useContext?: string | null;
  targetConstructCount?: number | null;
  targetItemsPerConstruct?: number | null;
  config?: Record<string, unknown> | null;
  presetId?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export function mapInstrumentBuildRow(row: DbRow): InstrumentBuildDto {
  return {
    id: str(row.id),
    name: str(row.name),
    status: str(row.status) || "draft",
    measureType: str(row.measure_type) || "competency_behavioural",
    brief: strOpt(row.brief),
    audience: jsonOpt(row.audience),
    useContext: strOpt(row.use_context),
    targetConstructCount: numericToNumber(row.target_construct_count),
    targetItemsPerConstruct: numericToNumber(row.target_items_per_construct),
    config: jsonOpt(row.config),
    presetId: strOpt(row.preset_id),
    createdBy: strOpt(row.created_by),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
    deletedAt: strOpt(row.deleted_at),
  };
}

export function mapInstrumentBuildRows(rows: DbRow[]): InstrumentBuildDto[] {
  return (rows ?? []).map(mapInstrumentBuildRow);
}

// ============================================================================
// Blueprint DTOs
// ============================================================================

export interface InstrumentBlueprintDto {
  id: string;
  buildId: string;
  constructId?: string | null;
  draftConstructName?: string | null;
  draftConstructDefinition?: string | null;
  measureType: string;
  targetAlpha?: number | null;
  exclusions?: string[] | null;
  notes?: string | null;
  version: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export function mapInstrumentBlueprintRow(row: DbRow): InstrumentBlueprintDto {
  return {
    id: str(row.id),
    buildId: str(row.build_id),
    constructId: strOpt(row.construct_id),
    draftConstructName: strOpt(row.draft_construct_name),
    draftConstructDefinition: strOpt(row.draft_construct_definition),
    measureType: str(row.measure_type) || "competency_behavioural",
    targetAlpha: numericToNumber(row.target_alpha),
    exclusions: strArrayOpt(row.exclusions),
    notes: strOpt(row.notes),
    version: numericToNumber(row.version) ?? 1,
    status: str(row.status) || "draft",
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
    deletedAt: strOpt(row.deleted_at),
  };
}

export function mapInstrumentBlueprintRows(
  rows: DbRow[],
): InstrumentBlueprintDto[] {
  return (rows ?? []).map(mapInstrumentBlueprintRow);
}

// ============================================================================
// Blueprint Cell DTOs
// ============================================================================

export function mapInstrumentBlueprintCellRow(row: DbRow): BlueprintCell {
  return {
    id: str(row.id),
    facetLabel: str(row.facet_label),
    intensity: intensityOf(row.intensity),
    targetItemCount: numericToNumber(row.target_item_count) ?? 2,
    displayOrder: numericToNumber(row.display_order) ?? 0,
  };
}

export function mapInstrumentBlueprintCellRows(rows: DbRow[]): BlueprintCell[] {
  return (rows ?? []).map(mapInstrumentBlueprintCellRow);
}

// ============================================================================
// Candidate Item DTOs
// ============================================================================

export interface InstrumentCandidateItemDto {
  id: string;
  buildId: string;
  blueprintCellId?: string | null;
  stem: string;
  stemObserver?: string | null;
  reverseScored?: boolean | null;
  rationale?: string | null;
  facet?: string | null;
  difficultyTier?: string | null;
  sdRisk?: string | null;
  sdRating?: number | null;
  readingGrade?: number | null;
  payload?: Record<string, unknown> | null;
  status: string;
  publishedItemId?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export function mapInstrumentCandidateItemRow(
  row: DbRow,
): InstrumentCandidateItemDto {
  return {
    id: str(row.id),
    buildId: str(row.build_id),
    blueprintCellId: strOpt(row.blueprint_cell_id),
    stem: str(row.stem),
    stemObserver: strOpt(row.stem_observer),
    reverseScored: boolOpt(row.reverse_scored),
    rationale: strOpt(row.rationale),
    facet: strOpt(row.facet),
    difficultyTier: strOpt(row.difficulty_tier),
    sdRisk: strOpt(row.sd_risk),
    sdRating: numericToNumber(row.sd_rating),
    readingGrade: numericToNumber(row.reading_grade),
    payload: jsonOpt(row.payload),
    status: str(row.status) || "candidate",
    publishedItemId: strOpt(row.published_item_id),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
    deletedAt: strOpt(row.deleted_at),
  };
}

export function mapInstrumentCandidateItemRows(
  rows: DbRow[],
): InstrumentCandidateItemDto[] {
  return (rows ?? []).map(mapInstrumentCandidateItemRow);
}

// ============================================================================
// Stage Run DTOs
// ============================================================================

export interface InstrumentStageRunDto {
  id: string;
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
  createdAt: string;
}

export function mapInstrumentStageRunRow(row: DbRow): InstrumentStageRunDto {
  return {
    id: str(row.id),
    buildId: str(row.build_id),
    stageKey: str(row.stage_key),
    status: (str(row.status) || "pending") as InstrumentStageRunDto["status"],
    severity: strOpt(row.severity),
    progressPct: numericToNumber(row.progress_pct),
    detail: strOpt(row.detail),
    inputSnapshot: jsonOpt(row.input_snapshot),
    outputSnapshot: jsonOpt(row.output_snapshot),
    tokenUsage: jsonOpt(row.token_usage),
    errorMessage: strOpt(row.error_message),
    startedAt: strOpt(row.started_at),
    completedAt: strOpt(row.completed_at),
    createdAt: str(row.created_at),
  };
}

export function mapInstrumentStageRunRows(
  rows: DbRow[],
): InstrumentStageRunDto[] {
  return (rows ?? []).map(mapInstrumentStageRunRow);
}

// ============================================================================
// Evidence DTOs (from src/lib/instrument/types.ts EvidenceRecord)
// ============================================================================

/**
 * The evidence DTO mirrors `EvidenceRecord` in src/lib/instrument/types.ts and
 * the `instrument_evidence` table. `value` is the number the record exists to
 * carry (e.g. a forecast alpha) — dropping it would make the ledger useless.
 */
export type EvidenceRecordDto = EvidenceRecord;

export function mapInstrumentEvidenceRow(row: DbRow): EvidenceRecordDto {
  const low = numericToNumber(row.interval_low);
  const high = numericToNumber(row.interval_high);

  return {
    id: str(row.id),
    targetType: (str(row.target_type) || "instrument") as EvidenceRecord["targetType"],
    targetId: str(row.target_id),
    claim: str(row.claim),
    value: numericToNumber(row.value) ?? Number.NaN,
    interval: low !== undefined && high !== undefined ? [low, high] : undefined,
    evidenceClass: (str(row.evidence_class) || "a_priori") as EvidenceClass,
    method: str(row.method),
    sampleSize: numericToNumber(row.sample_size),
    producedAt: new Date(str(row.created_at)),
    // A row is superseded when superseded_by points at another record. We do
    // not have the superseding row's timestamp here, so mark it with this
    // record's own timestamp; null means "still live".
    supersededAt: row.superseded_by ? new Date(str(row.created_at)) : null,
  };
}

export function mapInstrumentEvidenceRows(rows: DbRow[]): EvidenceRecordDto[] {
  return (rows ?? []).map(mapInstrumentEvidenceRow);
}
