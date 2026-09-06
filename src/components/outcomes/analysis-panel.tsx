"use client";
/** Extends the existing consultant workspace: all relationships first, then
 * model evidence, a traceable estimate, and the saved executive report. Uses
 * the platform's tables, controls and theme; every figure belongs to one run. */
import { useState } from "react";
import { Download } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { OutcomeRun } from "@/lib/outcomes/types";
import {
  outcomeAnalysisCsv,
  outcomeScatter,
  statistic,
  predictorLabel,
} from "@/lib/outcomes/analysis";
import { groupComparisonText } from "@/lib/outcomes/report";
import { OutcomePanel } from "./panel";
import { OutcomeField, OutcomeSelect } from "./fields";
import { OutcomeEffectPlot } from "./effect-plot";
import { OutcomeScatterPlot } from "./scatter-plot";
import {
  OutcomeKpiEstimate,
  OutcomeRegressionPanel,
  type OutcomeReportSelection,
} from "./regression-panel";

export function OutcomeAnalysisPanel({
  run,
  runs,
  setRunId,
  campaigns,
  onReport,
}: {
  run: OutcomeRun;
  runs: OutcomeRun[];
  setRunId: (id: string) => void;
  campaigns: { id: string; title: string }[];
  onReport: (selection: OutcomeReportSelection) => void;
}) {
  const displayPredictors = run.input.predictors.map((p) => ({
    ...p,
    label: predictorLabel(p, run.input.predictors),
  }));
  const [metricId, setMetricId] = useState(
    run.input.config.metrics[0]?.id ?? "",
  );
  const [predictorId, setPredictorId] = useState(
    run.input.predictors[0]?.id ?? "",
  );
  const [method, setMethod] = useState<"pearson" | "spearman">("pearson");
  const [view, setView] = useState<
    "Relationships" | "Regression" | "KPI estimate"
  >("Relationships");
  const result =
    run.result?.results.find((r) => r.metricId === metricId) ??
    run.result?.results[0];
  const metric = run.input.config.metrics.find(
    (m) => m.id === result?.metricId,
  );
  const predictor =
    displayPredictors.find((p) => p.id === predictorId) ?? displayPredictors[0];
  const finding = result?.findings.find((f) => f.predictorId === predictor?.id);
  const select = (metric: string, predictor: string) => {
    setMetricId(metric);
    setPredictorId(predictor);
  };
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([outcomeAnalysisCsv(run)], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "business-outcomes-all-estimates.csv";
    link.click();
    URL.revokeObjectURL(url);
  };
  const pairValue = (f: typeof finding) =>
    method === "pearson" ? f?.correlation?.value : f?.spearman;
  const points =
    metric && predictor ? outcomeScatter(run, metric.id, predictor.id) : [];
  return (
    <div className="min-w-0 space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <OutcomeField label="Analysis run">
          <OutcomeSelect
            value={run.id}
            onChange={(e) => setRunId(e.target.value)}
          >
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                {new Date(r.createdAt).toLocaleString("en-AU")} · {r.status}
              </option>
            ))}
          </OutcomeSelect>
        </OutcomeField>
        <OutcomeField label="Business measure">
          <OutcomeSelect
            value={metric?.id ?? metricId}
            onChange={(e) => setMetricId(e.target.value)}
          >
            {run.input.config.metrics.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </OutcomeSelect>
        </OutcomeField>
        <OutcomeField label="Selected capability">
          <OutcomeSelect
            value={predictor?.id ?? predictorId}
            onChange={(e) => setPredictorId(e.target.value)}
          >
            {displayPredictors.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} · {p.assessment}
              </option>
            ))}
          </OutcomeSelect>
        </OutcomeField>
      </div>
      {run.status !== "completed" && (
        <Alert variant={run.status === "failed" ? "destructive" : "info"}>
          <AlertDescription>
            {run.status === "failed"
              ? "Analysis failed. Review the error and start a new run."
              : "Analysis is running. This view refreshes automatically."}
            {run.error && <span className="mt-2 block">{run.error}</span>}
          </AlertDescription>
        </Alert>
      )}
      {run.result && metric && result && predictor && finding && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
            <nav aria-label="Analysis views" className="flex flex-wrap gap-2">
              {(["Relationships", "Regression", "KPI estimate"] as const).map(
                (v) => (
                  <Button
                    key={v}
                    variant={view === v ? "default" : "ghost"}
                    aria-pressed={view === v}
                    onClick={() => setView(v)}
                  >
                    {v}
                  </Button>
                ),
              )}
            </nav>
            <Button variant="outline" onClick={download}>
              <Download className="size-4" />
              Export all estimates
            </Button>
          </div>
          <details className="rounded-lg border px-5 py-3">
            <summary className="min-h-9 cursor-pointer text-sm font-medium">
              People behind the findings · {run.input.quality.eligible} included
              from {run.input.quality.imported} imported rows
            </summary>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              <p>
                {run.input.quality.matched} matched to people. {result.n}{" "}
                observed KPI values; {result.missing} missing; {result.model.n}{" "}
                complete people in the adjusted model.
              </p>
              {Object.entries(run.input.quality.excluded).map(([reason, n]) => (
                <p key={reason}>
                  {n} rows excluded: {reason.toLowerCase()}.
                </p>
              ))}
            </div>
          </details>
          {view === "Relationships" && (
            <>
              <OutcomePanel
                title="All capabilities × all business KPIs"
                description="Inspect the full set before choosing a lead finding. Correlations are unadjusted; use regression to account for the other capabilities and business context."
              >
                <div
                  className="mb-5 flex flex-wrap gap-2"
                  aria-label="Correlation method"
                >
                  {(["pearson", "spearman"] as const).map((m) => (
                    <Button
                      key={m}
                      variant={m === method ? "secondary" : "ghost"}
                      size="sm"
                      aria-pressed={m === method}
                      onClick={() => setMethod(m)}
                    >
                      {m === "pearson" ? "Pearson r" : "Spearman ρ"}
                    </Button>
                  ))}
                </div>
                <DataTable
                  revealOnScroll={false}
                  hideClientPagination
                  pageSize={10}
                  data={displayPredictors}
                  columns={[
                    {
                      accessorKey: "label",
                      header: "Capability",
                      cell: ({ row }) => (
                        <span className="font-medium">
                          {row.original.label}
                        </span>
                      ),
                    },
                    ...run.input.config.metrics.map((m) => ({
                      id: m.id,
                      header: m.label,
                      cell: ({
                        row,
                      }: {
                        row: { original: typeof predictor };
                      }) => {
                        const f = run
                            .result!.results.find((r) => r.metricId === m.id)
                            ?.findings.find(
                              (f) => f.predictorId === row.original.id,
                            ),
                          value = pairValue(f),
                          selected =
                            m.id === metric.id &&
                            row.original.id === predictor.id;
                        return (
                          <button
                            type="button"
                            className={`min-h-12 min-w-20 rounded-md px-4 text-sm font-medium tabular-nums text-foreground ${selected ? "outline-2 -outline-offset-2 outline-primary" : "hover:underline"}`}
                            aria-pressed={selected}
                            aria-label={`${row.original.label} against ${m.label}, ${method} ${statistic(value)}, ${f?.n ?? 0} people`}
                            style={{
                              backgroundColor: `color-mix(in oklab, var(--primary) ${value == null ? 0 : 8 + Math.abs(value) * 35}%, var(--card))`,
                            }}
                            onClick={() => select(m.id, row.original.id)}
                          >
                            {value == null ? "—" : statistic(value, 2)}
                          </button>
                        );
                      },
                    })),
                  ]}
                />
                <p className="mt-3 text-xs text-muted-foreground">
                  Shade shows absolute strength. −1 to +1 gives direction;
                  negative can be favourable when lower KPI values are better.
                  Select a cell for its evidence. All selected KPIs are
                  included.
                </p>
                <div className="mt-5 border-t pt-4 text-sm" aria-live="polite">
                  <p className="font-medium">
                    {predictor.label} × {metric.label}
                  </p>
                  <p className="mt-2 text-muted-foreground">
                    n = {finding.n} ·{" "}
                    {method === "pearson"
                      ? `r = ${statistic(finding.correlation?.value)} · 95% CI ${statistic(finding.correlation?.lower)} to ${statistic(finding.correlation?.upper)} · p = ${statistic(finding.correlation?.p)} · q = ${statistic(finding.correlation?.q)}`
                      : `ρ = ${statistic(finding.spearman)} · p = ${statistic(finding.spearmanTest?.p)} · q = ${statistic(finding.spearmanTest?.q)}`}
                  </p>
                  {finding.reason && (
                    <p className="mt-2 text-muted-foreground">
                      {finding.reason}
                    </p>
                  )}
                </div>
              </OutcomePanel>
              <OutcomePanel
                title={`${predictor.label} and ${metric.label}`}
                description={`Unadjusted relationship. KPI unit: ${metric.kind === "binary" ? "probability (0–1)" : metric.display === "currency" ? metric.currency : metric.unit || "native units"}${metric.exposureColumn ? ` per ${metric.exposureColumn}` : ""}.`}
              >
                <OutcomeScatterPlot
                  key={`${run.id}-${metric.id}-${predictor.id}`}
                  points={points}
                  xLabel="Capability score"
                  yLabel={
                    metric.kind === "binary"
                      ? "Outcome (0 or 1)"
                      : metric.display === "currency"
                        ? `Outcome (${metric.currency})`
                        : `Outcome (${metric.unit || "native units"})`
                  }
                  total={finding.n}
                  trend={finding.trend}
                />
              </OutcomePanel>
              <OutcomePanel
                title={`All capabilities against ${metric.label}`}
                description="Sorted by absolute correlation. Adjusted coefficients can differ from the simple relationships because the model accounts for other predictors."
              >
                <DataTable
                  revealOnScroll={false}
                  hideClientPagination
                  pageSize={10}
                  data={[...result.findings].sort(
                    (a, b) =>
                      Math.abs(pairValue(b) ?? 0) - Math.abs(pairValue(a) ?? 0),
                  )}
                  columns={[
                    {
                      id: "capability",
                      header: "Capability",
                      cell: ({ row }) => (
                        <button
                          type="button"
                          className="min-h-9 text-left text-primary underline underline-offset-4"
                          onClick={() =>
                            setPredictorId(row.original.predictorId)
                          }
                        >
                          {
                            displayPredictors.find(
                              (p) => p.id === row.original.predictorId,
                            )?.label
                          }
                        </button>
                      ),
                    },
                    { accessorKey: "n", header: "Pair n" },
                    {
                      id: "pearson",
                      header: "Pearson r",
                      cell: ({ row }) =>
                        statistic(row.original.correlation?.value),
                    },
                    {
                      id: "spearman",
                      header: "Spearman ρ",
                      cell: ({ row }) => statistic(row.original.spearman),
                    },
                    {
                      id: "adjusted",
                      header: "Adjusted B",
                      cell: ({ row }) =>
                        statistic(row.original.adjusted?.value),
                    },
                    {
                      id: "ci",
                      header: "95% CI for B",
                      cell: ({ row }) =>
                        row.original.adjusted
                          ? `${statistic(row.original.adjusted.lower)} to ${statistic(row.original.adjusted.upper)}`
                          : "—",
                    },
                    {
                      id: "q",
                      header: "Adjusted q",
                      cell: ({ row }) => statistic(row.original.adjusted?.q),
                    },
                    { accessorKey: "status", header: "Evidence" },
                  ]}
                />
                <p className="mt-3 text-xs text-muted-foreground">
                  Continuous B: KPI units per score point. Binary B: log odds.
                  Count B: log rates. Pearson and Spearman q values use separate
                  study-wide families; adjusted q values use the coefficient
                  family.
                </p>
                <details className="mt-5">
                  <summary className="min-h-9 cursor-pointer text-sm font-medium">
                    Observed group differences and uncertainty
                  </summary>
                  <div className="mt-3 space-y-3 text-xs leading-relaxed text-muted-foreground">
                    {result.findings.map((f) => (
                      <p key={f.predictorId}>
                        {groupComparisonText(
                          f,
                          metric,
                          displayPredictors.find((p) => p.id === f.predictorId)
                            ?.label ?? "Capability",
                        )}
                      </p>
                    ))}
                  </div>
                </details>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setView("Regression")}
                  >
                    Inspect the joint regression
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setView("KPI estimate")}
                  >
                    Calculate a KPI estimate
                  </Button>
                </div>
              </OutcomePanel>
            </>
          )}
          {view === "Regression" && (
            <>
              <OutcomePanel title="Adjusted relationships on a common score scale">
                <OutcomeEffectPlot
                  result={result}
                  predictors={displayPredictors}
                />
              </OutcomePanel>
              <OutcomeRegressionPanel
                run={run}
                metric={metric}
                result={result}
                campaigns={campaigns}
                onSelect={setPredictorId}
              />
              <Button variant="outline" onClick={() => setView("KPI estimate")}>
                Calculate a KPI estimate for {predictor.label}
              </Button>
            </>
          )}
          {view === "KPI estimate" && (
            <OutcomeKpiEstimate
              key={`${run.id}-${metric.id}-${predictor.id}`}
              metric={metric}
              result={result}
              finding={finding}
              predictor={predictor}
              onReport={onReport}
            />
          )}
          <details className="rounded-lg border p-5">
            <summary className="min-h-9 cursor-pointer text-sm font-medium">
              Interpretation checks and analysis provenance
            </summary>
            <div className="mt-3 space-y-3 text-sm text-muted-foreground">
              {[...run.input.quality.warnings, ...run.result.warnings].map(
                (w, i) => (
                  <p key={i}>{w}</p>
                ),
              )}
              <p className="break-all text-xs">
                Engine {run.result.engineVersion} · source checksum{" "}
                {run.input.source.checksum} · seed {run.result.seed}.{" "}
                {Object.entries(run.result.libraryVersions)
                  .map(([k, v]) => `${k} ${v}`)
                  .join(" · ")}
              </p>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
