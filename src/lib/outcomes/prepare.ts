import { createHash } from "node:crypto";
import type {
  OutcomeConfig,
  OutcomeInput,
  OutcomePredictor,
  OutcomeRow,
} from "./types";
import { strictNumber } from "./validation";
export interface SourceSession {
  id: string;
  campaign_id: string;
  campaign_participant_id: string;
  assessment_id: string;
  completed_at: string;
  assessments: { title: string } | null;
}
export interface SourcePerson {
  id: string;
  person_key: string;
  email: string;
  campaign_id: string;
}
export interface SourceScore {
  session_id: string;
  factor_id: string;
  scaled_score: number;
  scoring_method: string;
  metric: string | null;
  scoring_variant: string | null;
  parameter_scale_code: string | null;
  norm_version: string | null;
  norm_group_id: string | null;
  factors: { name: string } | null;
}
export function predictorFor(
  score: SourceScore,
  session: SourceSession,
): OutcomePredictor {
  const identity = [
    session.assessment_id,
    score.factor_id,
    score.scoring_method,
    score.metric ?? "",
    score.scoring_variant ?? "",
    score.parameter_scale_code ?? "",
    score.norm_version ?? "",
    score.norm_group_id ?? "",
  ];
  return {
    id: createHash("sha256").update(JSON.stringify(identity)).digest("hex"),
    assessmentId: session.assessment_id,
    assessment: session.assessments?.title ?? "Assessment",
    label: score.factors?.name ?? "Capability",
    factorId: score.factor_id,
    scoreField: "scaled_score",
    scoringMethod: score.scoring_method,
    metric: score.metric ?? "",
    variant: score.scoring_variant ?? "",
    parameterScale: score.parameter_scale_code ?? "",
    normVersion: score.norm_version ?? "",
    normGroupId: score.norm_group_id ?? "",
  };
}
export function prepareOutcomeInput(args: {
  config: OutcomeConfig;
  headers: string[];
  records: string[][];
  sessions: SourceSession[];
  people: SourcePerson[];
  scores: SourceScore[];
  source: OutcomeInput["source"];
}): OutcomeInput {
  const { config, headers, records, sessions, people, scores, source } = args;
  if (
    !config.periodStart ||
    !config.periodEnd ||
    !config.metrics.length ||
    !config.predictorIds.length ||
    !config.comparabilityReviewed
  )
    throw new Error(
      "Set the outcome period, choose metrics and capabilities, and review score comparability.",
    );
  const mapped = [
    config.joinColumn,
    ...config.metrics.flatMap((m) => [
      m.column,
      ...(m.exposureColumn ? [m.exposureColumn] : []),
    ]),
    ...config.controls.map((c) => c.column),
  ];
  if (mapped.some((c) => !headers.includes(c)))
    throw new Error("A mapped column is missing from the selected import.");
  if (
    new Set(config.metrics.map((m) => m.id)).size !== config.metrics.length ||
    new Set(config.metrics.map((m) => m.column)).size !== config.metrics.length
  )
    throw new Error(
      "Each outcome must have a unique identifier and source column.",
    );
  if (
    new Set(config.controls.map((c) => c.column)).size !==
      config.controls.length ||
    config.controls.some(
      (c) =>
        config.metrics.some((m) => m.column === c.column) ||
        c.column === config.joinColumn,
    )
  )
    throw new Error(
      "Context controls must be distinct from the join key and outcomes.",
    );
  const ledger: Record<string, number> = {};
  const excluded = (reason: string) => {
    ledger[reason] = (ledger[reason] ?? 0) + 1;
  };
  const identities = new Map<string, Set<string>>();
  for (const p of people) {
    const key = (config.joinMode === "email" ? p.email : p.person_key)
      .trim()
      .toLowerCase();
    if (!identities.has(key)) identities.set(key, new Set());
    identities.get(key)!.add(p.person_key);
  }
  const personForParticipant = new Map(people.map((p) => [p.id, p.person_key]));
  const sessionMap = new Map(sessions.map((s) => [s.id, s]));
  const catalog = new Map<string, OutcomePredictor>();
  const available = new Map<
    string,
    Map<string, { score: number; session: SourceSession }>
  >();
  const start = Date.parse(config.periodStart + "T00:00:00.000Z");
  const earliest = start - config.maxScoreAgeDays * 86400000;
  for (const score of scores) {
    const session = sessionMap.get(score.session_id);
    if (!session) continue;
    const predictor = predictorFor(score, session);
    catalog.set(predictor.id, predictor);
    if (!config.predictorIds.includes(predictor.id)) continue;
    const completed = Date.parse(session.completed_at);
    const person = personForParticipant.get(session.campaign_participant_id);
    if (
      !person ||
      !Number.isFinite(completed) ||
      completed >= start ||
      completed < earliest ||
      !Number.isFinite(Number(score.scaled_score))
    )
      continue;
    if (!available.has(person)) available.set(person, new Map());
    const earlier = available.get(person)!.get(predictor.id);
    if (!earlier || completed > Date.parse(earlier.session.completed_at))
      available
        .get(person)!
        .set(predictor.id, { score: Number(score.scaled_score), session });
  }
  if (config.predictorIds.some((id) => !catalog.has(id)))
    throw new Error(
      "A selected capability no longer exists in these campaigns. Refresh the score selection.",
    );
  const joinIndex = headers.indexOf(config.joinColumn);
  const counts = new Map<string, number>();
  const matches = records.map((row) => {
    const key = (row[joinIndex] ?? "").trim().toLowerCase();
    const matches = identities.get(key);
    const person = matches?.size === 1 ? [...matches][0] : null;
    if (person) counts.set(person, (counts.get(person) ?? 0) + 1);
    return { person, ambiguous: (matches?.size ?? 0) > 1 };
  });
  const rows: OutcomeRow[] = [];
  let matched = 0;
  records.forEach((record, index) => {
    const { person, ambiguous } = matches[index];
    if (!person) {
      excluded(ambiguous ? "Ambiguous identity" : "No matching participant");
      return;
    }
    matched++;
    if (counts.get(person) !== 1) {
      excluded("Duplicate business rows for one person");
      return;
    }
    const selected = available.get(person);
    if (!selected?.size) {
      excluded("No eligible assessment before the outcome period");
      return;
    }
    const outcomes: OutcomeRow["outcomes"] = {},
      exposures: OutcomeRow["exposures"] = {},
      controls: OutcomeRow["controls"] = {};
    const read = (column: string) => record[headers.indexOf(column)] ?? "";
    for (const metric of config.metrics) {
      const raw = read(metric.column).trim(),
        value = strictNumber(raw);
      if (raw && value === null)
        throw new Error(
          `Row ${index + 2}: ${metric.label} must be a number without currency symbols or percent signs.`,
        );
      if (
        value !== null &&
        ((metric.kind === "binary" && ![0, 1].includes(value)) ||
          (metric.kind === "count" &&
            (!Number.isInteger(value) || value < 0)) ||
          (metric.minimum !== null && value < metric.minimum) ||
          (metric.maximum !== null && value > metric.maximum))
      )
        throw new Error(
          `Row ${index + 2}: ${metric.label} is outside its declared values or range.`,
        );
      if (metric.exposureColumn && metric.kind !== "count")
        throw new Error("Exposure is supported for count outcomes only.");
      outcomes[metric.id] = value;
      exposures[metric.id] = metric.exposureColumn
        ? strictNumber(read(metric.exposureColumn))
        : null;
      if (
        value !== null &&
        metric.exposureColumn &&
        !(exposures[metric.id] !== null && exposures[metric.id]! > 0)
      )
        throw new Error(
          `Row ${index + 2}: ${metric.label} needs positive exposure.`,
        );
    }
    for (const control of config.controls) {
      const raw = read(control.column).trim();
      controls[control.column] =
        control.kind === "numeric" ? strictNumber(raw) : raw || null;
      if (
        raw &&
        control.kind === "numeric" &&
        controls[control.column] === null
      )
        throw new Error(
          `Row ${index + 2}: ${control.column} must be numeric or blank.`,
        );
    }
    if (Object.values(outcomes).every((v) => v === null)) {
      excluded("All mapped outcomes are missing");
      return;
    }
    const latest = [...selected.values()].sort((a, b) =>
      b.session.completed_at.localeCompare(a.session.completed_at),
    )[0];
    rows.push({
      id: createHash("sha256")
        .update(source.checksum + person)
        .digest("hex"),
      cohort: latest.session.campaign_id,
      scores: Object.fromEntries(
        config.predictorIds.map((id) => [id, selected.get(id)?.score ?? null]),
      ),
      outcomes,
      exposures,
      controls,
    });
  });
  if (!rows.length)
    throw new Error(
      "No eligible people remain. Check matching keys, duplicate rows, assessment dates and the outcome period.",
    );
  const warnings = [
    "Each person appears once. For each capability, the latest eligible assessment before the outcome period is used.",
    "Different assessment instruments and scoring versions are kept separate. Comparability across forms was reviewed by the consultant.",
  ];
  if (Object.keys(ledger).length)
    warnings.push(
      "Some imported rows were excluded; review the inclusion counts before publishing.",
    );
  return {
    version: 1,
    config,
    predictors: config.predictorIds.map((id) => catalog.get(id)!),
    rows,
    quality: {
      imported: records.length,
      matched,
      eligible: rows.length,
      excluded: ledger,
      warnings,
    },
    source,
  };
}
