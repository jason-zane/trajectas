export type OutcomeKind = "continuous" | "binary" | "count";
export interface OutcomeMetric {
  id: string;
  column: string;
  label: string;
  kind: OutcomeKind;
  unit: string;
  direction: "higher" | "lower";
  display: "number" | "percent" | "currency";
  currency: string;
  minimum: number | null;
  maximum: number | null;
  exposureColumn: string;
}
export interface OutcomeConfig {
  campaignIds: string[];
  predictorIds: string[];
  importId: string;
  joinColumn: string;
  joinMode: "person_key" | "email";
  periodStart: string;
  periodEnd: string;
  maxScoreAgeDays: number;
  controls: { column: string; kind: "numeric" | "category" }[];
  metrics: OutcomeMetric[];
  comparabilityReviewed: boolean;
}
export interface OutcomePredictor {
  id: string;
  label: string;
  assessmentId: string;
  assessment: string;
  factorId: string;
  scoreField: "scaled_score";
  scoringMethod: string;
  metric: string;
  variant: string;
  parameterScale: string;
  normVersion: string;
  normGroupId: string;
}
export interface OutcomeRow {
  id: string;
  cohort: string;
  scores: Record<string, number | null>;
  controls: Record<string, number | string | null>;
  outcomes: Record<string, number | null>;
  exposures: Record<string, number | null>;
}
export interface OutcomeInput {
  version: 1;
  config: OutcomeConfig;
  predictors: OutcomePredictor[];
  rows: OutcomeRow[];
  quality: {
    imported: number;
    matched: number;
    eligible: number;
    excluded: Record<string, number>;
    warnings: string[];
  };
  source: {
    checksum: string;
    filename: string;
    extractedAt: string;
    formVersions: string[];
  };
}
export interface Estimate {
  value: number;
  lower: number;
  upper: number;
  p: number;
  q?: number;
}
export interface OutcomeFinding {
  predictorId: string;
  n: number;
  correlation: Estimate | null;
  spearman: number | null;
  groups: {
    low: number;
    high: number;
    lowN: number;
    highN: number;
    difference: number;
    lower: number;
    upper: number;
  } | null;
  adjusted: Estimate | null;
  adjustedPerSd?: Estimate | null;
  scoreMin: number | null;
  scoreMax: number | null;
  scoreMean: number | null;
  status: "supported" | "inconclusive" | "unavailable";
  reason: string | null;
}
export interface OutcomeMetricResult {
  metricId: string;
  n: number;
  missing: number;
  mean: number | null;
  sd: number | null;
  findings: OutcomeFinding[];
  model: {
    method: string;
    n: number;
    parameters: number;
    controls: string[];
    warnings: string[];
    unavailable: string | null;
  };
  validation: {
    method: string;
    n: number;
    folds: number;
    metric: string;
    baseline: number;
    assessment: number;
    improvement: number;
  } | null;
  validationReason: string | null;
}
export interface OutcomeResult {
  engineVersion: string;
  libraryVersions: Record<string, string>;
  seed: number;
  results: OutcomeMetricResult[];
  warnings: string[];
}
export interface OutcomeImport {
  id: string;
  filename: string;
  createdAt: string;
  rowCount: number;
  headers: string[];
  preview: string[][];
}
export interface OutcomeRun {
  id: string;
  createdAt: string;
  status: "queued" | "running" | "completed" | "failed";
  error: string | null;
  result: OutcomeResult | null;
  input: Omit<OutcomeInput, "rows">;
}
export interface OutcomeStudy {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  question: string;
  config: OutcomeConfig;
  revision: number;
  createdAt: string;
}
export interface OutcomeScenario {
  enabled: boolean;
  shift: number;
  people: number;
  periods: number;
  valuePerUnit: number | null;
  cost: number;
  currency: string;
}
export interface OutcomeReportDraft {
  metricId: string;
  predictorId: string;
  headline: string;
  interpretation: string;
  recommendation: string;
  scenario: OutcomeScenario;
}
export interface OutcomeReportPayload {
  version: 1;
  study: Pick<OutcomeStudy, "title" | "question" | "clientName">;
  draft: OutcomeReportDraft;
  config: OutcomeConfig;
  predictors: OutcomePredictor[];
  quality: OutcomeInput["quality"];
  source: OutcomeInput["source"];
  result: OutcomeResult;
  runId: string;
  runCreatedAt: string;
}
export interface OutcomeReport {
  id: string;
  title: string;
  createdAt: string;
  revokedAt: string | null;
  payload: OutcomeReportPayload;
}
export const EMPTY_OUTCOME_CONFIG: OutcomeConfig = {
  campaignIds: [],
  predictorIds: [],
  importId: "",
  joinColumn: "",
  joinMode: "person_key",
  periodStart: "",
  periodEnd: "",
  maxScoreAgeDays: 365,
  controls: [],
  metrics: [],
  comparabilityReviewed: false,
};
