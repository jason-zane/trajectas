import { TrajectasLogo } from "@/components/brand/trajectas-logo";
import type { OutcomeMetric, OutcomeReportPayload } from "@/lib/outcomes/types";
import {
  metricValue,
  groupComparisonText,
  selectedReportFinding,
  scenarioValues,
  findingSummary,
  reportSections,
} from "@/lib/outcomes/report";
import { DataTable } from "@/components/data-table";
import { predictorLabel } from "@/lib/outcomes/analysis";
import { Alert, AlertDescription } from "@/components/ui/alert";
function GroupChart({
  low,
  high,
  metric,
  lowN,
  highN,
}: {
  low: number;
  high: number;
  metric: OutcomeMetric;
  lowN: number;
  highN: number;
}) {
  const min = Math.min(0, low, high),
    max = Math.max(0, low, high),
    span = max - min || 1,
    zero = ((0 - min) / span) * 100;
  return (
    <figure
      className="space-y-5"
      aria-label={`Average ${metric.label} by capability score group`}
    >
      {[
        { label: "Lower capability scores", value: low, n: lowN },
        { label: "Higher capability scores", value: high, n: highN },
      ].map((row, index) => {
        const end = ((row.value - min) / span) * 100;
        return (
          <div key={row.label}>
            <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
              <span>
                {row.label}{" "}
                <span className="text-muted-foreground">· {row.n} people</span>
              </span>
              <strong className="tabular-nums">
                {metricValue(row.value, metric)}
              </strong>
            </div>
            <div className="relative h-11 overflow-hidden rounded-sm bg-muted/40">
              <span
                className="absolute inset-y-0 w-px bg-border"
                style={{ left: `${zero}%` }}
              />
              <span
                className={`absolute inset-y-1 rounded-sm ${index ? "bg-primary" : "bg-muted-foreground/45"}`}
                style={{
                  left: `${Math.min(zero, end)}%`,
                  width: `${Math.abs(end - zero)}%`,
                }}
              />
            </div>
          </div>
        );
      })}
      <figcaption className="text-xs leading-relaxed text-muted-foreground">
        Average {metric.label} in the lowest and highest score quartiles. Ties
        stay together. These are observed group differences; business context
        can also influence the outcome.
      </figcaption>
    </figure>
  );
}
export function OutcomeExecutiveReport({
  payload,
  technical = false,
}: {
  payload: OutcomeReportPayload;
  technical?: boolean;
}) {
  const { metric, result, finding, predictor } = selectedReportFinding(payload);
  let scenario: ReturnType<typeof scenarioValues> = null,
    scenarioError = "";
  try {
    scenario = scenarioValues(payload);
  } catch (error) {
    scenarioError =
      error instanceof Error ? error.message : "Review the scenario.";
  }
  const sections = reportSections(payload.draft);
  const capabilityLabel = (id: string) => {
    const capability = payload.predictors.find((p) => p.id === id);
    return capability
      ? predictorLabel(capability, payload.predictors)
      : "Capability";
  };
  const groups = finding.groups,
    difference = groups?.difference ?? null;
  const money = (n: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: payload.draft.scenario.currency,
      maximumFractionDigits: 0,
    }).format(n);
  return (
    <article className="overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-sm">
      <div className="border-b px-6 py-5 md:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TrajectasLogo variant="wordmark" height={26} />
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            Business Outcomes · {payload.study.clientName}
          </span>
        </div>
      </div>
      <div className="space-y-9 p-6 md:p-10">
        <header>
          <p className="text-overline text-primary">
            {metric.label} · {payload.config.periodStart} to{" "}
            {payload.config.periodEnd}
          </p>
          <h2 className="mt-4 max-w-4xl text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
            {payload.draft.headline}
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {payload.study.question}
          </p>
        </header>
        <section
          className={`grid gap-8 border-y py-8 ${sections.comparison ? "md:grid-cols-[.85fr_1.15fr]" : ""}`}
          aria-label="The business finding"
        >
          <div>
            <p className="text-overline text-muted-foreground">
              {difference === null ? "Evidence so far" : "Observed difference"}
            </p>
            <p className="mt-3 text-3xl font-extrabold tracking-tight tabular-nums md:text-4xl">
              {difference === null
                ? "Further evidence needed"
                : metricValue(Math.abs(difference), metric, true)}
            </p>
            {difference !== null && (
              <p className="mt-2 text-sm">
                {difference > 0
                  ? "Higher"
                  : difference < 0
                    ? "Lower"
                    : "The same"}{" "}
                {metric.label.toLowerCase()} in the higher{" "}
                {predictor.label.toLowerCase()} score group.
              </p>
            )}
            <p className="mt-5 text-xs font-medium text-primary">
              {findingSummary(finding, metric)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {result.n} people with this business measure ·{" "}
              {metric.direction === "higher" ? "Higher" : "Lower"} is better
            </p>
          </div>
          {sections.comparison && (
            <div>
              {groups ? (
                <GroupChart {...groups} metric={metric} />
              ) : (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  A reliable high-versus-low score comparison is not available
                  for this sample. The supporting analysis records what can and
                  cannot be concluded.
                </p>
              )}
            </div>
          )}
        </section>
        {sections.interpretation && (
          <section>
            <h3 className="text-section">What this means for the business</h3>
            <p className="mt-3 whitespace-pre-line text-base leading-relaxed">
              {payload.draft.interpretation}
            </p>
          </section>
        )}
        {scenarioError && (
          <Alert variant="warning">
            <AlertDescription>{scenarioError}</AlertDescription>
          </Alert>
        )}
        {scenario && (
          <section className="rounded-xl border border-primary/25 bg-primary/5 p-6">
            <p className="text-overline text-primary">Modelled scenario</p>
            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-3xl font-extrabold tabular-nums">
                  {metricValue(Math.abs(scenario.delta), metric, true)}
                </p>
                <p className="mt-2 text-sm">
                  {scenario.delta > 0
                    ? "Increase"
                    : scenario.delta < 0
                      ? "Decrease"
                      : "No change"}{" "}
                  in average {metric.label.toLowerCase()} per person per outcome
                  period.
                </p>
              </div>
              {scenario.gross !== null && (
                <div>
                  <p className="text-3xl font-extrabold tabular-nums">
                    {money(scenario.gross)}
                  </p>
                  <p className="mt-2 text-sm">
                    Estimated gross value under the stated conversion
                    assumptions.
                  </p>
                  {payload.draft.scenario.cost > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {money(scenario.net!)} after{" "}
                      {money(payload.draft.scenario.cost)} in costs.
                    </p>
                  )}
                </div>
              )}
            </div>
            <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
              Assumes a {payload.draft.scenario.shift}-point shift in{" "}
              {predictor.label}, across {payload.draft.scenario.people} people
              {scenario.gross !== null
                ? `, ${payload.draft.scenario.periods} outcome periods, and ${money(payload.draft.scenario.valuePerUnit!)} per outcome unit per person per period`
                : ""}
              . This extrapolates an observed relationship; it is not a forecast
              or a proven intervention effect.
            </p>
          </section>
        )}
        {sections.recommendation && (
          <section className="grid gap-4 border-t pt-7 md:grid-cols-[.35fr_1fr]">
            <h3 className="text-section">Recommended next step</h3>
            <p className="whitespace-pre-line text-sm leading-relaxed">
              {payload.draft.recommendation}
            </p>
          </section>
        )}
        <footer className="flex flex-wrap gap-x-8 gap-y-2 border-t pt-5 text-xs text-muted-foreground">
          <span>
            {payload.quality.eligible} people included of{" "}
            {payload.quality.imported} imported rows
          </span>
          <span>Assessment results precede the outcome period</span>
          <span>
            Observed associations do not establish the effect of a development
            programme.
          </span>
          <span>
            Analysis dated{" "}
            {new Date(payload.runCreatedAt).toLocaleDateString("en-AU")}
          </span>
        </footer>
        {technical && sections.technical && (
          <section
            className="space-y-6 border-t pt-8"
            aria-label="Technical appendix"
          >
            <h3 className="text-xl font-semibold">Evidence and methods</h3>
            <p className="text-sm text-muted-foreground">
              {result.model.method || result.model.unavailable}. Adjusted
              sample: {result.model.n}; parameters: {result.model.parameters}.
              Context:{" "}
              {result.model.controls.join(", ") ||
                "No business controls selected"}
              . Other selected assessment scores are included together.
            </p>
            <div className="space-y-6">
              {payload.result.results.map((appendix) => (
                <div key={appendix.metricId}>
                  <h4 className="mb-3 font-semibold">
                    {
                      payload.config.metrics.find(
                        (m) => m.id === appendix.metricId,
                      )?.label
                    }
                  </h4>
                  <p className="mb-3 text-xs text-muted-foreground">
                    {appendix.model.method || appendix.model.unavailable} ·{" "}
                    {appendix.model.n} complete people
                  </p>
                  {appendix.model.details?.kind === "linear" && (
                    <p className="mb-3 text-xs text-muted-foreground">
                      In-sample R²:{" "}
                      {appendix.model.details.r2?.toFixed(3) ?? "—"}; adjusted
                      R²: {appendix.model.details.adjustedR2?.toFixed(3) ?? "—"}
                      . Added R² beyond context:{" "}
                      {appendix.model.details.addedR2?.toFixed(3) ?? "—"}.
                    </p>
                  )}
                  <DataTable
                    data={appendix.findings}
                    pageSize={10}
                    columns={[
                      {
                        id: "capability",
                        header: "Capability",
                        cell: ({ row }) =>
                          capabilityLabel(row.original.predictorId),
                      },
                      { accessorKey: "n", header: "People" },
                      {
                        id: "association",
                        header: "Pearson r",
                        cell: ({ row }) =>
                          row.original.correlation?.value.toFixed(3) ??
                          "Unavailable",
                      },
                      {
                        id: "adjusted",
                        header: "Adjusted coefficient (95% interval)",
                        cell: ({ row }) => {
                          const e = row.original.adjusted;
                          return e
                            ? `${e.value.toFixed(3)} [${e.lower.toFixed(3)}, ${e.upper.toFixed(3)}]`
                            : "Unavailable";
                        },
                      },
                      {
                        id: "q",
                        header: "Adjusted q",
                        cell: ({ row }) =>
                          row.original.adjusted?.q?.toPrecision(3) ?? "—",
                      },
                      { accessorKey: "status", header: "Evidence" },
                    ]}
                  />
                  <div className="mt-4 space-y-3 text-xs leading-relaxed text-muted-foreground">
                    {appendix.findings.map((f) => (
                      <p key={f.predictorId}>
                        {groupComparisonText(
                          f,
                          payload.config.metrics.find(
                            (m) => m.id === appendix.metricId,
                          )!,
                          capabilityLabel(f.predictorId),
                        )}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Benjamini–Hochberg correction covers all estimable
              capability-by-KPI adjusted relationships in this run. Exploratory
              correlations form a separate family. Logistic coefficients are log
              odds; count coefficients are log rates. Correlation and quartile
              comparisons describe unadjusted relationships.
            </p>
            {result.validation ? (
              <p className="text-sm">
                {result.validation.method}: {result.validation.metric} changed
                from {result.validation.baseline.toFixed(3)} with business
                context alone to {result.validation.assessment.toFixed(3)} with
                assessment scores added. Lower error is better.{" "}
                {result.validation.folds} folds; {result.validation.n} people.
              </p>
            ) : (
              <p className="text-sm">Prediction: {result.validationReason}</p>
            )}
            <div className="space-y-2 text-sm text-muted-foreground">
              {[
                ...payload.quality.warnings,
                ...payload.result.warnings,
                ...result.model.warnings,
              ].map((w, i) => (
                <p key={i}>{w}</p>
              ))}
              {Object.entries(payload.quality.excluded).map(([reason, n]) => (
                <p key={reason}>
                  {reason}: {n} excluded rows.
                </p>
              ))}
            </div>
            {scenario && (
              <p className="text-sm">
                Scenario relationship uncertainty:{" "}
                {metricValue(scenario.interval[0], metric, true)} to{" "}
                {metricValue(scenario.interval[1], metric, true)} per person per
                period. This interval excludes implementation uncertainty and
                uncertainty in the value conversion.
              </p>
            )}
            <p className="break-all text-xs text-muted-foreground">
              Engine {payload.result.engineVersion} ·{" "}
              {Object.entries(payload.result.libraryVersions)
                .map(([k, v]) => `${k} ${v}`)
                .join(" · ")}{" "}
              · Seed {payload.result.seed}
              <br />
              Source checksum: {payload.source.checksum}
              <br />
              Run: {payload.runId}
            </p>
          </section>
        )}
      </div>
    </article>
  );
}
