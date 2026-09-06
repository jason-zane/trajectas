import { coefficientContrast } from "./analysis";
import type {
  OutcomeFinding,
  OutcomeMetric,
  OutcomeReportDraft,
  OutcomeReportPayload,
  OutcomeRun,
  OutcomeStudy,
} from "./types";
export function metricValue(
  value: number | null,
  metric: OutcomeMetric,
  delta = false,
): string {
  if (value === null || !Number.isFinite(value)) return "Unavailable";
  const numeric = metric.kind === "binary" ? value * 100 : value;
  const digits =
    metric.display === "currency" ? 0 : Math.abs(numeric) < 10 ? 2 : 1;
  const formatted = new Intl.NumberFormat("en-AU", {
    maximumFractionDigits: digits,
    ...(metric.display === "currency"
      ? { style: "currency", currency: metric.currency }
      : {}),
  }).format(numeric);
  if (metric.kind === "binary" || metric.display === "percent")
    return `${formatted}${delta ? " percentage points" : "%"}`;
  return `${formatted}${metric.unit && metric.display !== "currency" ? ` ${metric.unit}` : ""}${metric.kind === "count" && metric.exposureColumn ? ` per ${metric.exposureColumn.replaceAll("_", " ")}` : ""}`;
}
export function selectedReportFinding(payload: OutcomeReportPayload) {
  const metric = payload.config.metrics.find(
    (m) => m.id === payload.draft.metricId,
  );
  const result = payload.result.results.find(
    (r) => r.metricId === payload.draft.metricId,
  );
  const finding = result?.findings.find(
    (f) => f.predictorId === payload.draft.predictorId,
  );
  const predictor = payload.predictors.find(
    (p) => p.id === payload.draft.predictorId,
  );
  if (!metric || !result || !finding || !predictor)
    throw new Error("Select an outcome and capability from this analysis.");
  return { metric, result, finding, predictor };
}
export function scenarioValues(payload: OutcomeReportPayload) {
  const { metric, finding, result } = selectedReportFinding(payload),
    scenario = payload.draft.scenario;
  if (!scenario.enabled) return null;
  if (scenario.valuePerUnit !== null && !/^[A-Z]{3}$/.test(scenario.currency))
    throw new Error(
      "Enter a three-letter currency code for the financial scenario.",
    );
  if (
    metric.kind !== "continuous" ||
    finding.status !== "supported" ||
    !finding.adjusted
  )
    throw new Error(
      "Scenarios need a supported, adjusted continuous outcome relationship.",
    );
  const contrast = coefficientContrast(metric, result, finding, scenario.shift);
  const delta = contrast.value;
  const interval = [contrast.lower, contrast.upper];
  // An additive business quantity can be monetised only when its per-person,
  // per-period unit conversion is explicitly supplied by the consultant.
  const sign = metric.direction === "higher" ? 1 : -1;
  const gross =
    scenario.valuePerUnit === null
      ? null
      : delta *
        sign *
        scenario.people *
        scenario.periods *
        scenario.valuePerUnit;
  const conversion = scenario.valuePerUnit;
  const range =
    conversion === null
      ? null
      : interval
          .map(
            (v) => v * sign * scenario.people * scenario.periods * conversion,
          )
          .sort((a, b) => a - b);
  return {
    delta,
    interval,
    gross,
    net: gross === null ? null : gross - scenario.cost,
    financialRange: range,
  };
}
export function validateOutcomeReport(payload: OutcomeReportPayload) {
  const { result } = selectedReportFinding(payload);
  if (result.n < 10)
    throw new Error(
      "At least 10 observed people are required in a client report.",
    );
  scenarioValues(payload);
}
export function defaultReportDraft(
  run: OutcomeRun,
  metricId?: string,
  predictorId?: string,
): OutcomeReportDraft {
  const results = run.result?.results ?? [];
  const ranked = results
    .flatMap((r) => r.findings.map((f) => ({ r, f })))
    .sort((a, b) => (a.f.adjusted?.q ?? 2) - (b.f.adjusted?.q ?? 2));
  const selected =
      ranked.find(
        (x) =>
          (!metricId || x.r.metricId === metricId) &&
          (!predictorId || x.f.predictorId === predictorId),
      ) ?? ranked[0],
    metric = run.input.config.metrics.find(
      (m) => m.id === selected?.r.metricId,
    ),
    predictor = run.input.predictors.find(
      (p) => p.id === selected?.f.predictorId,
    );
  const supported = selected?.f.status === "supported";
  return {
    metricId: metric?.id ?? "",
    predictorId: predictor?.id ?? "",
    headline: supported
      ? `${predictor?.label} and ${metric?.label}: a relationship worth testing`
      : `What the data says about ${metric?.label ?? "business outcomes"}`,
    interpretation: supported
      ? `Higher ${predictor?.label} scores were associated with ${selected.f.adjusted!.value > 0 ? "higher" : "lower"} ${metric?.label} after adjusting for the other selected capabilities and business context. This identifies a relationship to investigate; it does not establish what a development intervention would change.`
      : "The available data does not yet establish a clear adjusted relationship. Use the findings to guide further measurement and a larger validation study.",
    recommendation:
      "Test a focused development initiative, define a meaningful KPI change in advance, and measure outcomes against a suitable comparison group.",
    sections: reportSections(),
    scenario: {
      enabled: false,
      shift: 1,
      people: run.input.quality.eligible,
      periods: 1,
      valuePerUnit: null,
      cost: 0,
      currency: metric?.currency ?? "AUD",
    },
  };
}
export function makeReportPreview(
  study: OutcomeStudy,
  run: OutcomeRun,
  draft: OutcomeReportDraft,
): OutcomeReportPayload {
  if (!run.result) throw new Error("Complete the analysis first.");
  return {
    version: 1,
    study: {
      title: study.title,
      question: study.question,
      clientName: study.clientName,
    },
    draft,
    config: run.input.config,
    predictors: run.input.predictors,
    quality: run.input.quality,
    source: run.input.source,
    result: run.result,
    runId: run.id,
    runCreatedAt: run.createdAt,
  };
}
export function findingSummary(
  finding: OutcomeFinding,
  metric: OutcomeMetric,
): string {
  if (finding.status !== "supported") return "Further evidence needed";
  const positive = (finding.adjusted?.value ?? 0) > 0;
  return positive === (metric.direction === "higher")
    ? "Favourable adjusted relationship"
    : "Adverse adjusted relationship";
}

export function reportSections(draft?: Pick<OutcomeReportDraft, "sections">) {
  return {
    comparison: true,
    interpretation: true,
    recommendation: true,
    technical: true,
    ...draft?.sections,
  };
}

export function redactSmallOutcomeCells(
  payload: OutcomeReportPayload,
): OutcomeReportPayload {
  const result = { ...payload.result };
  // Individual plot observations are for the authorised consultant only.
  delete result.plots;
  return {
    ...payload,
    result: {
      ...result,
      results: result.results.map((r) => ({
        ...r,
        model: {
          ...r.model,
          ...(r.model.details
            ? {
                details:
                  r.model.n < 10
                    ? null
                    : {
                        ...r.model.details,
                        residuals: [],
                        references: [],
                        terms: r.model.details.terms.filter(
                          (t) => t.kind === "capability",
                        ),
                      },
              }
            : {}),
        },
        ...(r.n < 10
          ? {
              mean: null,
              sd: null,
              validation: null,
              validationReason:
                "Small-cell output is suppressed in client reports.",
            }
          : {}),
        findings: r.findings.map((f) =>
          f.n < 10
            ? {
                ...f,
                scoreMin: null,
                scoreMax: null,
                scoreMean: null,
                correlation: null,
                spearman: null,
                spearmanTest: null,
                trend: null,
                groups: null,
                adjusted: null,
                adjustedPerSd: null,
                status: "unavailable" as const,
                reason: "Fewer than 10 people; estimates suppressed.",
              }
            : f,
        ),
      })),
    },
  };
}

export function groupComparisonText(
  finding: OutcomeFinding,
  metric: OutcomeMetric,
  label: string,
): string {
  const g = finding.groups;
  if (!g)
    return `${label}: no eligible high-versus-low score group comparison.`;
  return `${label}: higher score group (n=${g.highN}) minus lower score group (n=${g.lowN}): ${metricValue(g.difference, metric, true)}; descriptive 95% Welch interval ${metricValue(g.lower, metric, true)} to ${metricValue(g.upper, metric, true)}. This contrast is unadjusted for business context or campaign dependence.`;
}
