import type {
  OutcomeFinding,
  OutcomeMetric,
  OutcomeMetricResult,
  OutcomeModelTerm,
  OutcomePlotPoint,
  OutcomePredictor,
  OutcomeRun,
} from "./types";
import { csvCell } from "./validation";

export function statistic(
  value: number | null | undefined,
  digits = 3,
): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "—";
  if (value !== 0 && Math.abs(value) < 0.001) return value.toExponential(2);
  return new Intl.NumberFormat("en-AU", {
    maximumFractionDigits: digits,
  }).format(value);
}

export function outcomeScatter(
  run: OutcomeRun,
  metricId: string,
  predictorId: string,
): OutcomePlotPoint[] {
  const plots = run.result?.plots;
  if (!plots) return [];
  const x = plots.predictorIds.indexOf(predictorId),
    y = plots.metricIds.indexOf(metricId);
  if (x < 0 || y < 0) return [];
  return plots.points.flatMap((p) => {
    const score = p.scores[x],
      outcome = p.outcomes[y];
    return typeof score === "number" && typeof outcome === "number"
      ? [{ x: score, y: outcome }]
      : [];
  });
}

export function predictorLabel(
  predictor: OutcomePredictor,
  all: OutcomePredictor[],
): string {
  if (all.filter((p) => p.label === predictor.label).length < 2)
    return predictor.label;
  const context = [
    predictor.assessment,
    predictor.scoringMethod,
    predictor.metric,
    predictor.variant,
    predictor.parameterScale,
    predictor.normVersion,
  ]
    .filter(Boolean)
    .join(" · ");
  return `${predictor.label} · ${context} [${predictor.id.slice(0, 8)}]`;
}

export function modelTermLabel(
  term: OutcomeModelTerm,
  campaigns: { id: string; title: string }[],
): string {
  return term.kind === "campaign"
    ? `Campaign: ${campaigns.find((c) => c.id === term.label)?.title ?? term.label}`
    : term.label;
}

export function scoreReference(
  result: OutcomeMetricResult,
  finding: OutcomeFinding,
) {
  return (
    result.model.details?.terms.find(
      (t) => t.predictorId === finding.predictorId,
    )?.reference ??
    (finding.scoreMean !== null &&
    finding.scoreMin !== null &&
    finding.scoreMax !== null
      ? {
          mean: finding.scoreMean,
          minimum: finding.scoreMin,
          maximum: finding.scoreMax,
        }
      : null)
  );
}

export function coefficientContrast(
  metric: OutcomeMetric,
  result: OutcomeMetricResult,
  finding: OutcomeFinding,
  shift: number,
) {
  if (!finding.adjusted)
    throw new Error(
      "An adjusted model is required to calculate a KPI estimate.",
    );
  if (!Number.isFinite(shift))
    throw new Error("Enter a finite score difference.");
  const reference = scoreReference(result, finding);
  if (
    !reference ||
    reference.mean + shift < reference.minimum - 1e-9 ||
    reference.mean + shift > reference.maximum + 1e-9
  )
    throw new Error(
      "Keep the score difference within the observed score range.",
    );
  const e = finding.adjusted;
  const values = [e.value, e.lower, e.upper].map((value) =>
    metric.kind === "continuous" ? value * shift : Math.exp(value * shift),
  );
  if (values.some((v) => !Number.isFinite(v)))
    throw new Error(
      "This score difference produces an unstable estimate. Use a smaller difference.",
    );
  const mean =
    metric.kind === "continuous"
      ? (result.model.details?.outcomeMean ?? result.mean)
      : null;
  const predicted = mean === null ? null : mean + values[0];
  if (
    predicted !== null &&
    ((metric.minimum !== null && predicted < metric.minimum) ||
      (metric.maximum !== null && predicted > metric.maximum))
  )
    throw new Error(
      "The estimate falls outside its declared scale. Use a smaller score difference.",
    );
  return {
    kind:
      metric.kind === "continuous"
        ? ("difference" as const)
        : metric.kind === "binary"
          ? ("oddsRatio" as const)
          : ("rateRatio" as const),
    value: values[0],
    lower: Math.min(values[1], values[2]),
    upper: Math.max(values[1], values[2]),
    mean,
    predicted,
    reference,
  };
}

export function outcomeAnalysisCsv(run: OutcomeRun): string {
  const rows: unknown[][] = [
    [
      "run_id",
      "run_created_at",
      "engine_version",
      "metric_id",
      "metric_type",
      "metric_unit",
      "metric_display",
      "exposure_column",
      "period_start",
      "period_end",
      "direction",
      "predictor_id",
      "assessment_id",
      "factor_id",
      "assessment",
      "score_field",
      "scoring_method",
      "score_metric",
      "scoring_variant",
      "parameter_scale",
      "norm_version",
      "norm_group_id",
      "coefficient_unit",
      "metric",
      "capability",
      "pair_n",
      "model_n",
      "pearson_r",
      "pearson_p",
      "pearson_q",
      "spearman_rho",
      "spearman_p",
      "spearman_q",
      "adjusted_coefficient",
      "ci_lower",
      "ci_upper",
      "p",
      "q",
      "standardized_beta",
      "vif",
      "unique_delta_r2",
      "r2",
      "adjusted_r2",
      "status",
    ],
  ];
  for (const result of run.result?.results ?? [])
    for (const f of result.findings) {
      const term = result.model.details?.terms.find(
        (t) => t.predictorId === f.predictorId,
      );
      const metric = run.input.config.metrics.find(
        (m) => m.id === result.metricId,
      );
      const predictor = run.input.predictors.find(
        (p) => p.id === f.predictorId,
      );
      const unit =
        metric?.kind === "binary"
          ? "log odds per score point"
          : metric?.kind === "count"
            ? "log rate per score point"
            : `${metric?.display === "currency" ? metric.currency : metric?.display === "percent" ? "percentage points" : metric?.unit || "KPI units"} per score point`;
      rows.push([
        run.id,
        run.createdAt,
        run.result?.engineVersion,
        result.metricId,
        metric?.kind,
        metric?.display === "currency" ? metric.currency : metric?.unit,
        metric?.display,
        metric?.exposureColumn,
        run.input.config.periodStart,
        run.input.config.periodEnd,
        metric?.direction,
        f.predictorId,
        predictor?.assessmentId,
        predictor?.factorId,
        predictor?.assessment,
        predictor?.scoreField,
        predictor?.scoringMethod,
        predictor?.metric,
        predictor?.variant,
        predictor?.parameterScale,
        predictor?.normVersion,
        predictor?.normGroupId,
        unit,
        metric?.label,
        predictor?.label,
        f.n,
        result.model.n,
        f.correlation?.value,
        f.correlation?.p,
        f.correlation?.q,
        f.spearman,
        f.spearmanTest?.p,
        f.spearmanTest?.q,
        f.adjusted?.value,
        f.adjusted?.lower,
        f.adjusted?.upper,
        f.adjusted?.p,
        f.adjusted?.q,
        term?.standardizedBeta,
        term?.vif,
        result.model.details?.contributions.find(
          (c) => c.predictorId === f.predictorId,
        )?.deltaR2,
        result.model.details?.r2,
        result.model.details?.adjustedR2,
        f.status,
      ]);
    }
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}
