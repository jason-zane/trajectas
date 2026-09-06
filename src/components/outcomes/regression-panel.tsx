"use client";
import { useState } from "react";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmptyState } from "@/components/empty-state";
import type {
  OutcomeFinding,
  OutcomeMetric,
  OutcomeMetricResult,
  OutcomePredictor,
  OutcomeRun,
} from "@/lib/outcomes/types";
import {
  coefficientContrast,
  modelTermLabel,
  scoreReference,
  statistic,
  predictorLabel,
} from "@/lib/outcomes/analysis";
import { metricValue } from "@/lib/outcomes/report";
import { OutcomePanel } from "./panel";
import { OutcomeField } from "./fields";
import { OutcomeScatterPlot } from "./scatter-plot";

export interface OutcomeReportSelection {
  metricId: string;
  predictorId: string;
  shift?: number;
}
export function OutcomeKpiEstimate({
  metric,
  result,
  finding,
  predictor,
  onReport,
}: {
  metric: OutcomeMetric;
  result: OutcomeMetricResult;
  finding: OutcomeFinding;
  predictor: OutcomePredictor;
  onReport: (selection: OutcomeReportSelection) => void;
}) {
  const reference = scoreReference(result, finding);
  const [shiftText, setShiftText] = useState(() =>
    String(
      reference
        ? Number(Math.min(10, reference.maximum - reference.mean).toFixed(3))
        : 1,
    ),
  );
  const shift = shiftText.trim() ? Number(shiftText) : NaN;
  let contrast: ReturnType<typeof coefficientContrast> | null = null,
    error = "";
  try {
    contrast = coefficientContrast(metric, result, finding, shift);
  } catch (e) {
    error = e instanceof Error ? e.message : "Review the score difference.";
  }
  const value = (n: number) =>
    metric.kind === "continuous"
      ? metricValue(n, metric, true)
      : `${statistic(n)}×`;
  const supported = finding.status === "supported";
  return (
    <OutcomePanel
      title="Translate the coefficient into a business estimate"
      description={`${predictor.label} and ${metric.label}. Other selected capabilities and business context are held fixed.`}
    >
      <div className="max-w-sm">
        <OutcomeField
          label="Hypothetical score difference"
          hint={
            reference
              ? `Observed score range: ${statistic(reference.minimum)}–${statistic(reference.maximum)}. Model sample average: ${statistic(reference.mean)}.`
              : undefined
          }
        >
          <Input
            type="number"
            step="any"
            value={shiftText}
            onChange={(e) => setShiftText(e.target.value)}
            min={reference ? reference.minimum - reference.mean : undefined}
            max={reference ? reference.maximum - reference.mean : undefined}
          />
        </OutcomeField>
      </div>
      {error ? (
        <Alert variant="warning" className="mt-5">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : (
        contrast && (
          <div className="mt-6 space-y-4" aria-live="polite">
            <p className="text-base font-medium tabular-nums">
              {metric.kind === "continuous"
                ? `${statistic(finding.adjusted!.value, 4)} × ${statistic(shift)} = ${value(contrast.value)}`
                : `exp(${statistic(finding.adjusted!.value, 4)} × ${statistic(shift)}) = ${value(contrast.value)} ${contrast.kind === "oddsRatio" ? "the odds" : "the rate"}`}
            </p>
            <p className="text-sm">
              95% interval: {value(contrast.lower)} to {value(contrast.upper)}.
            </p>
            {contrast.mean !== null && contrast.predicted !== null && (
              <p className="text-sm">
                Average modelled outcome: {metricValue(contrast.mean, metric)} →{" "}
                {metricValue(contrast.predicted, metric)}. Average score:{" "}
                {statistic(contrast.reference.mean)} →{" "}
                {statistic(contrast.reference.mean + shift)}.
              </p>
            )}
            {metric.kind === "binary" && (
              <p className="text-sm text-muted-foreground">
                An odds ratio is not a probability change. Absolute probability
                differences depend on the starting probability and business
                context.
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              {supported
                ? "Supported adjusted association. This is a hypothetical comparison, not a promised effect of development."
                : "Inconclusive adjusted association. The evidence does not meet the study-wide significance threshold; this does not support a confident improvement claim."}{" "}
              The interval covers coefficient uncertainty, not individual
              prediction error.
            </p>
          </div>
        )
      )}
      <Button
        className="mt-6"
        variant="outline"
        onClick={() =>
          onReport({
            metricId: metric.id,
            predictorId: predictor.id,
            ...(supported && metric.kind === "continuous" && contrast
              ? { shift }
              : {}),
          })
        }
      >
        Use this finding in the report
      </Button>
    </OutcomePanel>
  );
}

export function OutcomeRegressionPanel({
  run,
  metric,
  result,
  campaigns,
  onSelect,
}: {
  run: OutcomeRun;
  metric: OutcomeMetric;
  result: OutcomeMetricResult;
  campaigns: { id: string; title: string }[];
  onSelect: (id: string) => void;
}) {
  const details = result.model.details;
  const label = (id: string) => {
    const p = run.input.predictors.find((p) => p.id === id);
    return p ? predictorLabel(p, run.input.predictors) : "Capability";
  };
  const unit =
    metric.kind === "binary"
      ? "log odds"
      : metric.kind === "count"
        ? "log rates"
        : "KPI units";
  const terms = details
    ? [...details.terms].sort(
        (a, b) =>
          Number(a.kind !== "capability") - Number(b.kind !== "capability"),
      )
    : [];
  return (
    <>
      <OutcomePanel
        title="Joint regression model"
        description="All selected capabilities enter together with the declared business controls. Estimates use the same complete-case sample."
      >
        <p className="text-sm">
          {result.model.method || result.model.unavailable}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          {result.model.n} complete people · {result.model.parameters}{" "}
          parameters · {result.n - result.model.n} observed people excluded from
          the model because a selected score or control is missing. Controls:{" "}
          {result.model.controls.join(", ") || "None selected"}.
        </p>
        {result.model.warnings.map((warning, index) => (
          <p className="mt-3 text-sm text-muted-foreground" key={index}>
            {warning}
          </p>
        ))}
        {!details ? (
          <div className="mt-5">
            <EmptyState
              size="sm"
              title={
                result.model.unavailable
                  ? "Model unavailable"
                  : "Additional diagnostics are not saved in this run"
              }
              description={
                result.model.unavailable ??
                "Run the analysis again to calculate full coefficients, model fit, unique contributions and residual diagnostics."
              }
            />
          </div>
        ) : (
          <>
            {details.kind === "linear" ? (
              <>
                <dl className="my-6 grid grid-cols-2 gap-5 border-y py-5 md:grid-cols-3">
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      R² · variation explained
                    </dt>
                    <dd className="mt-2 text-2xl font-semibold tabular-nums">
                      {statistic(details.r2)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Adjusted R²
                    </dt>
                    <dd className="mt-2 text-2xl font-semibold tabular-nums">
                      {statistic(details.adjustedR2)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Residual degrees of freedom
                    </dt>
                    <dd className="mt-2 text-2xl font-semibold tabular-nums">
                      {details.residualDf}
                    </dd>
                  </div>
                </dl>
                <p className="mb-5 text-sm text-muted-foreground">
                  R² values are proportions: 0.40 means 40% of the observed
                  variation.
                </p>
                <h3 className="text-section">What do assessment scores add?</h3>
                <div className="mt-4">
                  <DataTable
                    revealOnScroll={false}
                    hideClientPagination
                    pageSize={2}
                    data={[
                      {
                        id: "context",
                        name: "Business context alone",
                        r2: details.contextR2,
                        delta: null,
                      },
                      {
                        id: "full",
                        name: "Business context + all capabilities",
                        r2: details.r2,
                        delta: details.addedR2,
                      },
                    ]}
                    columns={[
                      { accessorKey: "name", header: "In-sample model" },
                      {
                        id: "r2",
                        header: "R²",
                        cell: ({ row }) => statistic(row.original.r2),
                      },
                      {
                        id: "delta",
                        header: "Added R²",
                        cell: ({ row }) =>
                          row.original.delta === null
                            ? "—"
                            : `${statistic(row.original.delta * 100, 2)} percentage points`,
                      },
                    ]}
                  />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  In-sample fit describes this dataset. The separate held-out
                  prediction check below tests how well the scores generalise.
                </p>
              </>
            ) : (
              <p className="my-5 text-sm">
                Model deviance: {statistic(details.deviance)} · Pearson
                dispersion: {statistic(details.dispersion)} · Residual degrees
                of freedom: {details.residualDf}. Ordinary linear R² and
                standardised linear beta do not apply to this model.
              </p>
            )}
            <h3 className="mt-7 text-section">Full coefficient table</h3>
            <p className="mt-2 text-xs text-muted-foreground">
              B uses {unit} per predictor unit. The 95% interval and SE use{" "}
              {result.model.method.includes("cluster")
                ? "campaign-clustered"
                : "robust"}{" "}
              uncertainty. Scroll the table on narrow screens to see every
              column.
            </p>
            <div className="mt-4">
              <DataTable
                revealOnScroll={false}
                hideClientPagination
                pageSize={160}
                data={terms}
                columns={[
                  {
                    id: "term",
                    header: "Term",
                    cell: ({ row }) =>
                      row.original.predictorId ? (
                        <button
                          type="button"
                          className="min-h-9 text-left font-medium text-primary underline underline-offset-4"
                          onClick={() => onSelect(row.original.predictorId!)}
                        >
                          {label(row.original.predictorId)}
                        </button>
                      ) : (
                        modelTermLabel(row.original, campaigns)
                      ),
                  },
                  {
                    id: "b",
                    header: "B",
                    cell: ({ row }) => statistic(row.original.estimate?.value),
                  },
                  {
                    id: "se",
                    header: "Robust SE",
                    cell: ({ row }) => statistic(row.original.standardError),
                  },
                  {
                    id: "beta",
                    header: "Std. β",
                    cell: ({ row }) => statistic(row.original.standardizedBeta),
                  },
                  {
                    id: "ci",
                    header: "95% CI for B",
                    cell: ({ row }) =>
                      row.original.estimate
                        ? `${statistic(row.original.estimate.lower)} to ${statistic(row.original.estimate.upper)}`
                        : "—",
                  },
                  {
                    id: "test",
                    header: details.kind === "linear" ? "t" : "z",
                    cell: ({ row }) => statistic(row.original.statistic),
                  },
                  {
                    id: "p",
                    header: "p",
                    cell: ({ row }) => statistic(row.original.estimate?.p),
                  },
                  {
                    id: "q",
                    header: "FDR q",
                    cell: ({ row }) => statistic(row.original.estimate?.q),
                  },
                ]}
              />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Standardised beta scales both capability and continuous KPI by
              their sample standard deviations. FDR q adjusts all estimable
              capability–KPI coefficient tests in this run. Control terms are
              outside that test family.
            </p>
            {details.references.length > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                Reference categories:{" "}
                {details.references
                  .map(
                    (r) =>
                      `${r.label}: ${r.label === "Campaign" ? (campaigns.find((c) => c.id === r.value)?.title ?? r.value) : r.value}`,
                  )
                  .join("; ")}
                .
              </p>
            )}
            {details.contributions.length > 0 && (
              <div className="mt-7">
                <h3 className="text-section">
                  Unique contribution of each capability
                </h3>
                <div className="mt-4">
                  <DataTable
                    revealOnScroll={false}
                    hideClientPagination
                    pageSize={10}
                    data={[...details.contributions].sort(
                      (a, b) => b.deltaR2 - a.deltaR2,
                    )}
                    columns={[
                      {
                        id: "name",
                        header: "Capability",
                        cell: ({ row }) => (
                          <button
                            type="button"
                            className="min-h-9 text-left text-primary underline underline-offset-4"
                            onClick={() => onSelect(row.original.predictorId)}
                          >
                            {label(row.original.predictorId)}
                          </button>
                        ),
                      },
                      {
                        id: "loss",
                        header: "R² lost if removed",
                        cell: ({ row }) =>
                          `${statistic(row.original.deltaR2 * 100, 2)} pp`,
                      },
                      {
                        id: "partial",
                        header: "Partial R²",
                        cell: ({ row }) => statistic(row.original.partialR2),
                      },
                      {
                        id: "vif",
                        header: "VIF",
                        cell: ({ row }) =>
                          statistic(
                            details.terms.find(
                              (t) => t.predictorId === row.original.predictorId,
                            )?.vif,
                            2,
                          ),
                      },
                    ]}
                  />
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  Each capability is removed from the same full model.
                  Contributions need not add to total R² because capabilities
                  can share information. Partial R² is its share of the variance
                  left unexplained by the model without that capability. VIF
                  measures predictor overlap.
                </p>
              </div>
            )}
            <details className="mt-7">
              <summary className="min-h-10 cursor-pointer text-sm font-medium">
                Model diagnostics and residuals
              </summary>
              <div className="mt-4 space-y-4">
                <p className="text-sm">
                  {details.rmse !== null &&
                    `In-sample RMSE: ${metricValue(details.rmse, metric)}. `}
                  {details.jointTest &&
                    `Robust joint F(${details.jointTest.numeratorDf}, ${details.jointTest.denominatorDf}) = ${statistic(details.jointTest.value)}, p = ${statistic(details.jointTest.p)}.`}
                </p>
                {details.maxCooksDistance !== null && (
                  <p className="text-sm">
                    Maximum Cook’s distance:{" "}
                    {statistic(details.maxCooksDistance)}. Review influential
                    observations before interpreting coefficients.
                  </p>
                )}
                <DataTable
                  revealOnScroll={false}
                  hideClientPagination
                  pageSize={160}
                  data={terms.filter((t) => t.kind !== "intercept")}
                  columns={[
                    {
                      id: "term",
                      header: "Term",
                      cell: ({ row }) =>
                        row.original.predictorId
                          ? label(row.original.predictorId)
                          : modelTermLabel(row.original, campaigns),
                    },
                    {
                      id: "vif",
                      header: "VIF",
                      cell: ({ row }) => statistic(row.original.vif, 2),
                    },
                  ]}
                />
                <OutcomeScatterPlot
                  key={`${run.id}-${metric.id}-residuals`}
                  points={details.residuals}
                  xLabel={
                    metric.kind === "binary"
                      ? "Fitted probability"
                      : metric.kind === "count"
                        ? "Fitted count"
                        : "Fitted KPI (native units)"
                  }
                  yLabel={
                    details.residualKind === "deviance"
                      ? "Deviance residual"
                      : "Residual (native KPI units)"
                  }
                  total={result.model.n}
                  zeroLine
                />
                <p className="text-xs text-muted-foreground">
                  Look for curvature, changing spread and unusual residuals.
                  These plots do not establish that the model is suitable;
                  review them with the study design and sample coverage.
                </p>
              </div>
            </details>
          </>
        )}
      </OutcomePanel>
      <OutcomePanel
        title="Does assessment improve prediction?"
        description="Both models use identical held-out people. Encoding and scaling are fitted inside each training fold."
      >
        {result.validation ? (
          <div className="space-y-4 text-sm">
            <p>
              {result.validation.method} · {result.validation.folds} folds ·{" "}
              {result.validation.n} people.
            </p>
            <DataTable
              revealOnScroll={false}
              hideClientPagination
              pageSize={2}
              data={[
                {
                  name: "Business controls alone",
                  error: result.validation.baseline,
                },
                {
                  name: "Business controls + assessment scores",
                  error: result.validation.assessment,
                },
              ]}
              columns={[
                { accessorKey: "name", header: "Prediction inputs" },
                {
                  id: "error",
                  header: result.validation.metric,
                  cell: ({ row }) =>
                    result.validation?.metric === "Brier score"
                      ? statistic(row.original.error)
                      : metricValue(row.original.error, metric),
                },
              ]}
            />
            <p className="text-xs text-muted-foreground">
              Lower error is better. This separate check uses{" "}
              {metric.kind === "continuous"
                ? "ridge regression"
                : "regularised logistic regression"}
              . Campaign identifiers are holdout groups, not transferable
              prediction inputs. With fewer than three campaigns, person
              holdouts do not establish performance in new campaigns.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {result.validationReason}
          </p>
        )}
      </OutcomePanel>
    </>
  );
}
