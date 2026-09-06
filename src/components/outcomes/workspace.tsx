"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
  Play,
  Save,
  Upload,
  FileCheck2,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import {
  getOutcomeRunsAction,
  saveOutcomeStudyAction,
  runOutcomeStudyAction,
  publishOutcomeReportAction,
  revokeOutcomeReportAction,
  saveOutcomeReportDraftAction,
} from "@/app/actions/outcomes";
import {
  defaultReportDraft,
  makeReportPreview,
  validateOutcomeReport,
  reportSections,
} from "@/lib/outcomes/report";
import type {
  OutcomeReportDraft,
  OutcomeConfig,
  OutcomeImport,
  OutcomeMetric,
  OutcomePredictor,
  OutcomeRun,
  OutcomeStudy,
} from "@/lib/outcomes/types";
import { predictorLabel } from "@/lib/outcomes/analysis";
import { outcomeConfigSchema } from "@/lib/outcomes/validation";
import { OutcomeExecutiveReport } from "./executive-report";
import { OutcomeAnalysisPanel } from "./analysis-panel";
import { OutcomePanel as Panel } from "./panel";
import type { OutcomeReportSelection } from "./regression-panel";
import { OutcomeField, OutcomeSelect } from "./fields";
interface WorkspaceProps {
  drafts: { runId: string; draft: OutcomeReportDraft; revision: number }[];
  study: OutcomeStudy;
  campaigns: { id: string; title: string }[];
  predictors: OutcomePredictor[];
  imports: OutcomeImport[];
  runs: OutcomeRun[];
  reports: {
    id: string;
    title: string;
    createdAt: string;
    revokedAt: string | null;
  }[];
}
const tabs = [
  "Study",
  "Business data",
  "Analysis",
  "Executive report",
] as const;
function newMetric(index: number): OutcomeMetric {
  return {
    id: `kpi_${Date.now()}_${index}`,
    column: "",
    label: "",
    kind: "continuous",
    unit: "points",
    direction: "higher",
    display: "number",
    currency: "AUD",
    minimum: null,
    maximum: null,
    exposureColumn: "",
  };
}
export function OutcomeWorkspace(props: WorkspaceProps) {
  const { study, campaigns, predictors, imports, reports } = props,
    router = useRouter();
  const [runs, setRuns] = useState(props.runs),
    [reportDirty, setReportDirty] = useState(false),
    [pendingRun, setPendingRun] = useState("");
  const [reportRequest, setReportRequest] = useState<{
    id: number;
    runId: string;
    selection: OutcomeReportSelection;
  } | null>(null);
  const [pendingReport, setPendingReport] =
    useState<OutcomeReportSelection | null>(null);
  useEffect(() => setRuns(props.runs), [props.runs]);
  const onReportDirty = useCallback(
    (dirty: boolean) => setReportDirty(dirty),
    [],
  );
  const [tab, setTab] = useState<(typeof tabs)[number]>("Study"),
    [config, setConfig] = useState(study.config),
    [saved, setSaved] = useState(JSON.stringify(study.config)),
    [revision, setRevision] = useState(study.revision);
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [savedFeedback, setSavedFeedback] = useState(false),
    [runId, setRunId] = useState(runs[0]?.id ?? "");
  const dirty = JSON.stringify(config) !== saved,
    unsaved = useUnsavedChanges(dirty || reportDirty);
  const active = runs.some((r) => ["queued", "running"].includes(r.status)),
    selectedRun = runs.find((r) => r.id === runId) ?? runs[0];
  const openFindingReport = (selection: OutcomeReportSelection) => {
    if (!selectedRun) return;
    setReportRequest((current) => ({
      id: (current?.id ?? 0) + 1,
      runId: selectedRun.id,
      selection,
    }));
    setTab("Executive report");
  };
  const changeRun = (id: string) => {
    setReportRequest(null);
    setRunId(id);
  };
  const imported = imports.find((i) => i.id === config.importId);
  useEffect(() => {
    if (!active) return;
    let pending = false;
    const timer = setInterval(async () => {
      if (pending) return;
      pending = true;
      const result = await getOutcomeRunsAction(study.id);
      pending = false;
      if (result.data) setRuns(result.data);
    }, 5000);
    return () => clearInterval(timer);
  }, [active, study.id]);
  const patch = (next: Partial<OutcomeConfig>) =>
    setConfig((c) => ({ ...c, ...next }));
  const fail = (message: string) => {
    setError(message);
    toast.error(message, { duration: 10000 });
  };
  async function save() {
    setBusy("save");
    setError("");
    const result = await saveOutcomeStudyAction(study.id, revision, config);
    setBusy("");
    if (result.error) fail(result.error);
    else {
      setRevision(result.data!);
      setSaved(JSON.stringify(config));
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2000);
      toast.success("Study saved");
      router.refresh();
    }
  }
  async function run() {
    if (reportDirty) {
      fail("Save your report draft before starting another analysis.");
      return;
    }
    setBusy("run");
    setError("");
    const result = await runOutcomeStudyAction(study.id);
    setBusy("");
    if (result.error) fail(result.error);
    else {
      changeRun(result.data!);
      setTab("Analysis");
      toast.success("Analysis queued");
      router.refresh();
    }
  }
  const setMetric = (index: number, next: Partial<OutcomeMetric>) =>
    patch({
      metrics: config.metrics.map((m, i) =>
        i === index ? { ...m, ...next } : m,
      ),
    });
  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <Link
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        href="/business-outcomes"
      >
        <ArrowLeft className="size-4" />
        All studies
      </Link>
      <PageHeader
        eyebrow={`Business Outcomes · ${study.clientName}`}
        title={study.title}
        description={study.question}
      />
      <div className="flex flex-wrap items-center justify-between gap-4 border-y py-4">
        <div
          className="flex flex-wrap gap-1"
          role="tablist"
          aria-label="Study workflow"
        >
          {tabs.map((t, i) => (
            <button
              type="button"
              key={t}
              role="tab"
              id={`outcomes-tab-${i}`}
              aria-controls="outcomes-panel"
              tabIndex={tab === t ? 0 : -1}
              onKeyDown={(event) => {
                if (
                  !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                    event.key,
                  )
                )
                  return;
                event.preventDefault();
                const next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? tabs.length - 1
                      : (i +
                          (event.key === "ArrowRight" ? 1 : -1) +
                          tabs.length) %
                        tabs.length;
                setTab(tabs[next]);
                document.getElementById(`outcomes-tab-${next}`)?.focus();
              }}
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-2 text-sm transition-colors ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              <span className="mr-2 font-mono text-xs opacity-70">
                0{i + 1}
              </span>
              {t}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={save}
            disabled={!!busy || !dirty || savedFeedback}
          >
            <Save className="size-4" />
            {busy === "save"
              ? "Saving…"
              : savedFeedback
                ? "Saved"
                : "Save changes"}
          </Button>
          <Button
            onClick={run}
            disabled={
              !!busy ||
              dirty ||
              reportDirty ||
              active ||
              !config.metrics.length ||
              !config.predictorIds.length
            }
          >
            <Play className="size-4" />
            {busy === "run"
              ? "Preparing…"
              : active
                ? "Analysis in progress"
                : "Run analysis"}
          </Button>
        </div>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {reportDirty && (
        <p className="text-sm text-muted-foreground" role="status">
          You have unsaved report edits. Save the report draft before starting
          another analysis.
        </p>
      )}
      {dirty && (
        <p className="text-sm text-muted-foreground" role="status">
          You have unsaved study changes. Save before running an analysis.
        </p>
      )}
      {selectedRun &&
        (tab === "Analysis" || tab === "Executive report") &&
        JSON.stringify(outcomeConfigSchema.parse(selectedRun.input.config)) !==
          JSON.stringify(outcomeConfigSchema.parse(JSON.parse(saved))) && (
          <Alert variant="info">
            <AlertDescription>
              These results use an earlier saved configuration. Run a new
              analysis to reflect the current study settings.
            </AlertDescription>
          </Alert>
        )}
      <div
        id="outcomes-panel"
        role="tabpanel"
        aria-labelledby={`outcomes-tab-${tabs.indexOf(tab)}`}
        tabIndex={0}
      >
        {tab === "Study" && (
          <div className="space-y-6">
            <Panel
              title="1. Choose the assessment population"
              description="Combine client campaigns with identifiable participants. Internal pilots, rater responses and campaigns promising aggregate-only confidentiality are excluded."
            >
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="max-h-72 space-y-3 overflow-auto rounded-lg border p-4">
                  {campaigns.length ? (
                    campaigns.map((c) => (
                      <label
                        key={c.id}
                        className="flex items-start gap-3 text-sm"
                      >
                        <input
                          type="checkbox"
                          className="mt-1 accent-primary"
                          checked={config.campaignIds.includes(c.id)}
                          onChange={(e) =>
                            patch({
                              campaignIds: e.target.checked
                                ? [...config.campaignIds, c.id]
                                : config.campaignIds.filter(
                                    (id) => id !== c.id,
                                  ),
                              predictorIds: [],
                              comparabilityReviewed: false,
                            })
                          }
                        />
                        <span>{c.title}</span>
                      </label>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No eligible campaigns for this client yet.
                    </p>
                  )}
                </div>
                <div className="space-y-5">
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Save your campaign selection to load its available scores. A
                    person is counted once across campaigns, using their latest
                    eligible score for each selected capability.
                  </p>
                  <OutcomeField
                    label="Maximum assessment age (days)"
                    hint="Measured backwards from the start of the business outcome period."
                  >
                    <Input
                      type="number"
                      min={1}
                      max={3650}
                      value={config.maxScoreAgeDays}
                      onChange={(e) =>
                        patch({ maxScoreAgeDays: Number(e.target.value) })
                      }
                    />
                  </OutcomeField>
                </div>
              </div>
            </Panel>
            <Panel
              title="2. Define the outcome period"
              description="Business data should represent one row per person for this fixed period. Assessment results must precede it; concurrent data should be analysed in a separately designed study."
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <OutcomeField label="Period starts">
                  <Input
                    type="date"
                    value={config.periodStart}
                    onChange={(e) => patch({ periodStart: e.target.value })}
                  />
                </OutcomeField>
                <OutcomeField label="Period ends">
                  <Input
                    type="date"
                    value={config.periodEnd}
                    onChange={(e) => patch({ periodEnd: e.target.value })}
                  />
                </OutcomeField>
              </div>
            </Panel>
            <Panel
              title="3. Select capabilities"
              description="Choose up to 10 compatible measures. Each assessment, scoring method and norm version is kept distinct; scores with different provenance are never silently combined."
            >
              {predictors.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {predictors.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-start gap-3 rounded-lg border p-4 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="mt-1 accent-primary"
                        checked={config.predictorIds.includes(p.id)}
                        disabled={
                          !config.predictorIds.includes(p.id) &&
                          config.predictorIds.length >= 10
                        }
                        onChange={(e) =>
                          patch({
                            predictorIds: e.target.checked
                              ? [...config.predictorIds, p.id]
                              : config.predictorIds.filter((id) => id !== p.id),
                            comparabilityReviewed: false,
                          })
                        }
                      />
                      <span>
                        <strong className="block">{p.label}</strong>
                        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                          {p.assessment} · {p.scoringMethod}
                          <br />
                          Scaled score ·{" "}
                          {p.normVersion
                            ? `Norm ${p.normVersion}`
                            : "No recorded norm version"}
                          {p.variant ? ` · ${p.variant}` : ""}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <EmptyState
                  size="sm"
                  title="Save campaigns to load scores"
                  description="Only completed, processed assessments with non-provisional scaled scores are eligible."
                />
              )}
              <label className="mt-6 flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 accent-primary"
                  checked={config.comparabilityReviewed}
                  onChange={(e) =>
                    patch({ comparabilityReviewed: e.target.checked })
                  }
                />
                <span>
                  I have reviewed score comparability across the selected
                  campaigns, including assessment forms, score scales and norm
                  versions.
                </span>
              </label>
            </Panel>
          </div>
        )}
        {tab === "Business data" && (
          <div className="space-y-6">
            <Panel
              title="Bring in the business measures"
              description="Upload one row per person for the outcome period. Leave missing values blank. Use numeric values without currency symbols, thousands separators or percent signs; binary outcomes use 0 and 1."
            >
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  CSV or XLSX · up to 5,000 rows · 4 MB
                </p>
                <a
                  className={buttonVariants({ variant: "outline" })}
                  href={`/api/outcomes/roster?studyId=${study.id}`}
                >
                  <Download className="size-4" />
                  Download participant template
                </a>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy("upload");
                  setError("");
                  const body = new FormData(e.currentTarget);
                  body.set("studyId", study.id);
                  try {
                    const response = await fetch("/api/outcomes/import", {
                      method: "POST",
                      body,
                    });
                    const result = await response.json();
                    if (!response.ok)
                      throw new Error(result.error ?? "Upload failed");
                    patch({
                      importId: result.data.id,
                      joinColumn: result.data.headers.includes("person_key")
                        ? "person_key"
                        : "",
                      metrics: [],
                      controls: [],
                    });
                    toast.success("Business data imported");
                    router.refresh();
                  } catch (error) {
                    fail(
                      error instanceof Error ? error.message : "Upload failed.",
                    );
                  } finally {
                    setBusy("");
                  }
                }}
                className="grid items-end gap-4 md:grid-cols-[1.4fr_1fr_auto]"
              >
                <OutcomeField label="Business data file">
                  <Input type="file" name="file" accept=".csv,.xlsx" required />
                </OutcomeField>
                <OutcomeField label="Excel sheet name (optional)">
                  <Input name="sheet" placeholder="First sheet by default" />
                </OutcomeField>
                <Button type="submit" disabled={!!busy}>
                  <Upload className="size-4" />
                  {busy === "upload" ? "Importing…" : "Import data"}
                </Button>
              </form>
              {imports.length > 0 && (
                <div className="mt-6">
                  <OutcomeField label="Source version">
                    <OutcomeSelect
                      value={config.importId}
                      onChange={(e) =>
                        patch({
                          importId: e.target.value,
                          joinColumn: "",
                          metrics: [],
                          controls: [],
                        })
                      }
                    >
                      <option value="">Choose an import</option>
                      {imports.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.filename} · {i.rowCount} rows ·{" "}
                          {new Date(i.createdAt).toLocaleString("en-AU")}
                        </option>
                      ))}
                    </OutcomeSelect>
                  </OutcomeField>
                </div>
              )}
            </Panel>
            {imported && (
              <>
                <Panel
                  title="Match people"
                  description="Use the person key in the downloaded template, or an exact email address. Matching stays within this client. Ambiguous identities and duplicate person rows are excluded and counted in the analysis record."
                >
                  <div className="grid gap-5 md:grid-cols-2">
                    <OutcomeField label="Match using">
                      <OutcomeSelect
                        value={config.joinMode}
                        onChange={(e) =>
                          patch({
                            joinMode: e.target
                              .value as OutcomeConfig["joinMode"],
                          })
                        }
                      >
                        <option value="person_key">Trajectas person key</option>
                        <option value="email">Email address</option>
                      </OutcomeSelect>
                    </OutcomeField>
                    <OutcomeField label="Identity column">
                      <OutcomeSelect
                        value={config.joinColumn}
                        onChange={(e) => patch({ joinColumn: e.target.value })}
                      >
                        <option value="">Choose a column</option>
                        {imported.headers.map((h) => (
                          <option key={h}>{h}</option>
                        ))}
                      </OutcomeSelect>
                    </OutcomeField>
                  </div>
                  <div className="mt-6 overflow-x-auto">
                    <DataTable
                      data={imported.preview.map((cells, i) => ({
                        id: i,
                        ...Object.fromEntries(
                          imported.headers.map((h, j) => [h, cells[j]]),
                        ),
                      }))}
                      columns={imported.headers
                        .slice(0, 8)
                        .map((h) => ({ accessorKey: h, header: h }))}
                      pageSize={8}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Preview: first 8 rows and up to 8 columns. The original
                    source is retained privately.
                  </p>
                </Panel>
                <Panel
                  title="Define the KPIs"
                  description="Each report uses the label, units and direction you choose here. Percent-valued continuous measures use 0–100 values; binary percentages are calculated from 0/1 outcomes."
                >
                  <div className="space-y-6">
                    {config.metrics.map((metric, index) => (
                      <div
                        key={metric.id}
                        className="space-y-4 rounded-lg border p-5"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold">Measure {index + 1}</h3>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              patch({
                                metrics: config.metrics.filter(
                                  (_, i) => i !== index,
                                ),
                              })
                            }
                          >
                            Remove
                          </Button>
                        </div>
                        <div className="grid gap-4 md:grid-cols-3">
                          <OutcomeField label="Source column">
                            <OutcomeSelect
                              value={metric.column}
                              onChange={(e) =>
                                setMetric(index, {
                                  column: e.target.value,
                                  label:
                                    metric.label ||
                                    e.target.value.replaceAll("_", " "),
                                })
                              }
                            >
                              <option value="">Choose a column</option>
                              {imported.headers.map((h) => (
                                <option key={h}>{h}</option>
                              ))}
                            </OutcomeSelect>
                          </OutcomeField>
                          <OutcomeField label="Report label">
                            <Input
                              value={metric.label}
                              maxLength={100}
                              onChange={(e) =>
                                setMetric(index, { label: e.target.value })
                              }
                              placeholder="Customer satisfaction"
                            />
                          </OutcomeField>
                          <OutcomeField label="Outcome type">
                            <OutcomeSelect
                              value={metric.kind}
                              onChange={(e) =>
                                setMetric(index, {
                                  kind: e.target.value as OutcomeMetric["kind"],
                                  exposureColumn: "",
                                  ...(e.target.value === "binary"
                                    ? {
                                        display: "percent",
                                        minimum: 0,
                                        maximum: 1,
                                        unit: "",
                                      }
                                    : {
                                        minimum: null,
                                        maximum: null,
                                        display: "number",
                                      }),
                                })
                              }
                            >
                              <option value="continuous">
                                Continuous: score, time or value
                              </option>
                              <option value="binary">
                                Binary: yes/no, retained/left
                              </option>
                              <option value="count">
                                Count: sales, errors or incidents
                              </option>
                            </OutcomeSelect>
                          </OutcomeField>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                          <OutcomeField label="Better outcome">
                            <OutcomeSelect
                              value={metric.direction}
                              onChange={(e) =>
                                setMetric(index, {
                                  direction: e.target
                                    .value as OutcomeMetric["direction"],
                                })
                              }
                            >
                              <option value="higher">Higher</option>
                              <option value="lower">Lower</option>
                            </OutcomeSelect>
                          </OutcomeField>
                          <OutcomeField label="Display">
                            <OutcomeSelect
                              value={metric.display}
                              disabled={metric.kind === "binary"}
                              onChange={(e) =>
                                setMetric(index, {
                                  display: e.target
                                    .value as OutcomeMetric["display"],
                                })
                              }
                            >
                              <option value="number">Number or score</option>
                              <option value="percent">Percentage</option>
                              <option value="currency">Currency</option>
                            </OutcomeSelect>
                          </OutcomeField>
                          {metric.display === "currency" ? (
                            <OutcomeField label="Currency (ISO code)">
                              <Input
                                value={metric.currency}
                                maxLength={3}
                                onChange={(e) =>
                                  setMetric(index, {
                                    currency: e.target.value.toUpperCase(),
                                  })
                                }
                              />
                            </OutcomeField>
                          ) : (
                            <OutcomeField label="Units">
                              <Input
                                value={metric.unit}
                                maxLength={40}
                                placeholder="points / hours / incidents"
                                onChange={(e) =>
                                  setMetric(index, { unit: e.target.value })
                                }
                              />
                            </OutcomeField>
                          )}
                          <OutcomeField label="Exposure column (counts only)">
                            <OutcomeSelect
                              value={metric.exposureColumn}
                              disabled={metric.kind !== "count"}
                              onChange={(e) =>
                                setMetric(index, {
                                  exposureColumn: e.target.value,
                                })
                              }
                            >
                              <option value="">No exposure adjustment</option>
                              {imported.headers.map((h) => (
                                <option key={h}>{h}</option>
                              ))}
                            </OutcomeSelect>
                          </OutcomeField>
                        </div>
                        <div className="grid max-w-lg gap-4 sm:grid-cols-2">
                          <OutcomeField label="Minimum valid value (optional)">
                            <Input
                              type="number"
                              step="any"
                              value={metric.minimum ?? ""}
                              onChange={(e) =>
                                setMetric(index, {
                                  minimum:
                                    e.target.value === ""
                                      ? null
                                      : Number(e.target.value),
                                })
                              }
                            />
                          </OutcomeField>
                          <OutcomeField label="Maximum valid value (optional)">
                            <Input
                              type="number"
                              step="any"
                              value={metric.maximum ?? ""}
                              onChange={(e) =>
                                setMetric(index, {
                                  maximum:
                                    e.target.value === ""
                                      ? null
                                      : Number(e.target.value),
                                })
                              }
                            />
                          </OutcomeField>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button
                    className="mt-5"
                    variant="outline"
                    onClick={() =>
                      patch({
                        metrics: [
                          ...config.metrics,
                          newMetric(config.metrics.length),
                        ],
                      })
                    }
                    disabled={config.metrics.length >= 8}
                  >
                    Add a business measure
                  </Button>
                </Panel>
                <Panel
                  title="Account for business context"
                  description="Choose up to five pre-existing factors such as tenure, job level or location. Avoid controls caused by the assessment outcome or measured after the KPI. Campaign differences are included automatically when estimable."
                >
                  <div className="space-y-4">
                    {config.controls.map((control, i) => (
                      <div
                        key={i}
                        className="grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto]"
                      >
                        <OutcomeField label={`Context column ${i + 1}`}>
                          <OutcomeSelect
                            value={control.column}
                            onChange={(e) =>
                              patch({
                                controls: config.controls.map((c, j) =>
                                  i === j
                                    ? { ...c, column: e.target.value }
                                    : c,
                                ),
                              })
                            }
                          >
                            <option value="">Choose a column</option>
                            {imported.headers.map((h) => (
                              <option key={h}>{h}</option>
                            ))}
                          </OutcomeSelect>
                        </OutcomeField>
                        <OutcomeField label="Context type">
                          <OutcomeSelect
                            value={control.kind}
                            onChange={(e) =>
                              patch({
                                controls: config.controls.map((c, j) =>
                                  i === j
                                    ? {
                                        ...c,
                                        kind: e.target.value as
                                          | "numeric"
                                          | "category",
                                      }
                                    : c,
                                ),
                              })
                            }
                          >
                            <option value="numeric">Numeric</option>
                            <option value="category">
                              Category (up to 20 values)
                            </option>
                          </OutcomeSelect>
                        </OutcomeField>
                        <Button
                          variant="ghost"
                          onClick={() =>
                            patch({
                              controls: config.controls.filter(
                                (_, j) => j !== i,
                              ),
                            })
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button
                    className="mt-5"
                    variant="outline"
                    disabled={config.controls.length >= 5}
                    onClick={() =>
                      patch({
                        controls: [
                          ...config.controls,
                          { column: "", kind: "numeric" },
                        ],
                      })
                    }
                  >
                    Add context control
                  </Button>
                </Panel>
              </>
            )}
          </div>
        )}
        <div hidden={tab !== "Analysis"}>
          {selectedRun ? (
            <OutcomeAnalysisPanel
              key={selectedRun.id}
              campaigns={campaigns}
              onReport={(selection) =>
                reportDirty
                  ? setPendingReport(selection)
                  : openFindingReport(selection)
              }
              run={selectedRun}
              runs={runs}
              setRunId={(id) =>
                reportDirty ? setPendingRun(id) : changeRun(id)
              }
            />
          ) : (
            <EmptyState
              title="Ready when your data is"
              description="Choose the population, map your business data, and run an analysis. Every run keeps its inputs and methods for review."
            />
          )}
        </div>
        <div hidden={tab !== "Executive report"}>
          {selectedRun?.result ? (
            <ReportBuilder
              reportRequest={
                reportRequest?.runId === selectedRun.id ? reportRequest : null
              }
              onDirty={onReportDirty}
              key={selectedRun.id}
              savedDraft={props.drafts.find((d) => d.runId === selectedRun.id)}
              study={study}
              run={selectedRun}
              reports={reports}
              refresh={() => router.refresh()}
            />
          ) : (
            <EmptyState
              title="Build the story from a completed analysis"
              description="The report will lead with the business measure and observed difference, with statistical detail in a separate appendix."
            />
          )}
        </div>
      </div>
      <ConfirmDialog
        open={!!pendingReport}
        onOpenChange={(open) => {
          if (!open) setPendingReport(null);
        }}
        title="Use a different finding in the report?"
        description="This will replace unsaved headline, interpretation and scenario edits with the selected finding. Save the current draft first to keep those edits."
        confirmLabel="Use selected finding"
        onConfirm={() => {
          if (pendingReport) openFindingReport(pendingReport);
          setPendingReport(null);
        }}
      />
      <ConfirmDialog
        open={!!pendingRun}
        onOpenChange={(open) => {
          if (!open) setPendingRun("");
        }}
        title="Change analysis run?"
        description="Save the report draft before changing runs, or discard its unsaved edits."
        confirmLabel="Discard edits"
        onConfirm={() => {
          changeRun(pendingRun);
          setPendingRun("");
          setReportDirty(false);
        }}
      />
      <ConfirmDialog
        open={unsaved.showDialog}
        onOpenChange={(open) => {
          if (!open) unsaved.cancelNavigation();
        }}
        title="Leave without saving?"
        description="Your study or report draft has unsaved changes."
        confirmLabel="Leave page"
        onConfirm={unsaved.confirmNavigation}
      />
    </div>
  );
}
function ReportBuilder({
  reportRequest,
  study,
  run,
  reports,
  refresh,
  savedDraft,
  onDirty,
}: {
  reportRequest: {
    id: number;
    runId: string;
    selection: OutcomeReportSelection;
  } | null;
  onDirty: (dirty: boolean) => void;
  savedDraft?: WorkspaceProps["drafts"][number];
  study: OutcomeStudy;
  run: OutcomeRun;
  reports: WorkspaceProps["reports"];
  refresh: () => void;
}) {
  const [draft, setDraft] = useState(
      () => savedDraft?.draft ?? defaultReportDraft(run),
    ),
    [technical, setTechnical] = useState(false),
    [busy, setBusy] = useState(false),
    [reviewed, setReviewed] = useState(false),
    [error, setError] = useState(""),
    [publishedDraftJson, setPublishedDraftJson] = useState(""),
    [revokeId, setRevokeId] = useState(""),
    [draftRevision, setDraftRevision] = useState(savedDraft?.revision ?? 0),
    [savedDraftJson, setSavedDraftJson] = useState(
      JSON.stringify(savedDraft?.draft ?? defaultReportDraft(run)),
    );
  const [appliedRequest, setAppliedRequest] = useState<number | null>(null);
  if (reportRequest && appliedRequest !== reportRequest.id) {
    setAppliedRequest(reportRequest.id);
    const { metricId, predictorId, shift } = reportRequest.selection;
    const next = defaultReportDraft(run, metricId, predictorId);
    setDraft((current) => ({
      ...next,
      sections: current.sections,
      recommendation: current.recommendation,
      scenario: {
        ...next.scenario,
        ...(shift === undefined ? {} : { enabled: true, shift }),
      },
    }));
    setReviewed(false);
  }
  const sections = reportSections(draft);
  const payload = makeReportPreview(study, run, draft),
    dirty =
      JSON.stringify(draft) !== publishedDraftJson &&
      JSON.stringify(draft) !== savedDraftJson;
  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty, onDirty]);
  const patch = (next: Partial<typeof draft>) => {
    setDraft((d) => ({ ...d, ...next }));
    setReviewed(false);
  };
  const scenario = (next: Partial<typeof draft.scenario>) =>
    patch({ scenario: { ...draft.scenario, ...next } });
  let validity = "";
  try {
    validateOutcomeReport(payload);
  } catch (e) {
    validity = e instanceof Error ? e.message : "Review the report.";
  }
  return (
    <div className="space-y-7">
      <Panel
        title="Tell the business story"
        description="Lead with what changed in the business measure, explain its meaning, and recommend a testable next step. Statistical detail stays in the optional appendix."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <OutcomeField label="Lead business measure">
            <OutcomeSelect
              value={draft.metricId}
              onChange={(e) =>
                patch({
                  ...defaultReportDraft(run, e.target.value, draft.predictorId),
                  recommendation: draft.recommendation,
                  sections: draft.sections,
                })
              }
            >
              {run.input.config.metrics.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </OutcomeSelect>
          </OutcomeField>
          <OutcomeField label="Lead capability">
            <OutcomeSelect
              value={draft.predictorId}
              onChange={(e) =>
                patch({
                  ...defaultReportDraft(run, draft.metricId, e.target.value),
                  recommendation: draft.recommendation,
                  sections: draft.sections,
                })
              }
            >
              {run.input.predictors.map((p) => (
                <option key={p.id} value={p.id}>
                  {predictorLabel(p, run.input.predictors)}
                  {run.input.predictors.filter(
                    (candidate) => candidate.label === p.label,
                  ).length === 1
                    ? ` · ${p.assessment}`
                    : ""}
                </option>
              ))}
            </OutcomeSelect>
          </OutcomeField>
        </div>
        <div className="mt-5 space-y-5">
          <OutcomeField label="Executive headline">
            <Input
              maxLength={160}
              value={draft.headline}
              onChange={(e) => patch({ headline: e.target.value })}
            />
          </OutcomeField>
          <OutcomeField label="Business interpretation">
            <Textarea
              rows={3}
              maxLength={2000}
              value={draft.interpretation}
              onChange={(e) => patch({ interpretation: e.target.value })}
            />
          </OutcomeField>
          <OutcomeField label="Recommended next step">
            <Textarea
              rows={2}
              maxLength={2000}
              value={draft.recommendation}
              onChange={(e) => patch({ recommendation: e.target.value })}
            />
          </OutcomeField>
        </div>
        <fieldset className="mt-6 border-t pt-5">
          <legend className="pt-5 text-sm font-semibold">
            Executive briefing sections
          </legend>
          <p className="mt-2 text-xs text-muted-foreground">
            These choices are saved with the report and apply to both the client
            view and PDF.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {(
              [
                ["comparison", "Observed comparison chart"],
                ["interpretation", "Business interpretation"],
                ["recommendation", "Recommended next step"],
                ["technical", "Technical appendix"],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex min-h-10 items-center gap-3 text-sm"
              >
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={sections[key]}
                  onChange={(e) =>
                    patch({
                      sections: { ...sections, [key]: e.target.checked },
                    })
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-6 border-t pt-5">
          <label className="flex items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              className="accent-primary"
              checked={draft.scenario.enabled}
              onChange={(e) => scenario({ enabled: e.target.checked })}
            />
            Include a modelled KPI scenario
          </label>
          <p className="mt-2 text-xs text-muted-foreground">
            Optional. Available for supported continuous outcomes. A financial
            conversion is optional and must reflect a defensible business
            assumption.
          </p>
        </div>
        {draft.scenario.enabled && (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <OutcomeField label="Capability score shift">
              <Input
                type="number"
                step="any"
                value={draft.scenario.shift}
                onChange={(e) => scenario({ shift: Number(e.target.value) })}
              />
            </OutcomeField>
            <OutcomeField label="People affected">
              <Input
                type="number"
                min={1}
                value={draft.scenario.people}
                onChange={(e) => scenario({ people: Number(e.target.value) })}
              />
            </OutcomeField>
            <OutcomeField label="Value per KPI unit per person (optional)">
              <Input
                type="number"
                step="any"
                min={0}
                value={draft.scenario.valuePerUnit ?? ""}
                placeholder="Leave blank for a non-financial report"
                onChange={(e) =>
                  scenario({
                    valuePerUnit:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </OutcomeField>
            {draft.scenario.valuePerUnit !== null && (
              <>
                <OutcomeField label="Number of outcome periods">
                  <Input
                    type="number"
                    min={1}
                    value={draft.scenario.periods}
                    onChange={(e) =>
                      scenario({ periods: Number(e.target.value) })
                    }
                  />
                </OutcomeField>
                <OutcomeField label="Implementation cost">
                  <Input
                    type="number"
                    min={0}
                    value={draft.scenario.cost}
                    onChange={(e) => scenario({ cost: Number(e.target.value) })}
                  />
                </OutcomeField>
                <OutcomeField label="Scenario currency">
                  <Input
                    maxLength={3}
                    value={draft.scenario.currency}
                    onChange={(e) =>
                      scenario({ currency: e.target.value.toUpperCase() })
                    }
                  />
                </OutcomeField>
              </>
            )}
          </div>
        )}
        {(error || validity) && (
          <Alert variant="warning" className="mt-5">
            <AlertDescription>{error || validity}</AlertDescription>
          </Alert>
        )}
      </Panel>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-section">Executive report preview</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Preview only. Publishing freezes the findings, narrative and
            scenario into a new report version.
          </p>
        </div>
        {sections.technical && (
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={technical}
              className="accent-primary"
              onChange={(e) => setTechnical(e.target.checked)}
            />
            Show technical appendix
          </label>
        )}
      </div>
      <OutcomeExecutiveReport payload={payload} technical={technical} />
      <div className="space-y-4 rounded-xl border bg-card p-6">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 accent-primary"
            checked={reviewed}
            onChange={(e) => setReviewed(e.target.checked)}
          />
          <span>
            I have reviewed the inclusion counts, all KPI findings, model
            limitations and report wording. The report distinguishes observed
            differences from scenario assumptions.
          </span>
        </label>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            disabled={busy || JSON.stringify(draft) === savedDraftJson}
            onClick={async () => {
              setBusy(true);
              const result = await saveOutcomeReportDraftAction(
                study.id,
                run.id,
                draftRevision,
                draft,
              );
              setBusy(false);
              if (result.error) {
                setError(result.error);
                toast.error(result.error);
              } else {
                setDraftRevision(result.data!);
                setSavedDraftJson(JSON.stringify(draft));
                toast.success("Report draft saved");
                refresh();
              }
            }}
          >
            <Save className="size-4" />
            Save report draft
          </Button>
          <Button
            disabled={busy || !reviewed || !!validity}
            onClick={async () => {
              setBusy(true);
              setError("");
              const result = await publishOutcomeReportAction(
                study.id,
                run.id,
                draft,
              );
              setBusy(false);
              if (result.error) {
                setError(result.error);
                toast.error(result.error);
              } else {
                setPublishedDraftJson(JSON.stringify(draft));
                toast.success("Report published");
                refresh();
              }
            }}
          >
            <FileCheck2 className="size-4" />
            {busy ? "Working…" : "Publish report version"}
          </Button>
        </div>
      </div>
      {!!reports.length && (
        <Panel title="Published reports">
          <div className="divide-y">
            {reports.map((report) => (
              <div
                key={report.id}
                className="flex flex-wrap items-center justify-between gap-4 py-4"
              >
                <div>
                  <p className="font-medium">{report.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(report.createdAt).toLocaleString("en-AU")}
                    {report.revokedAt ? " · Revoked" : ""}
                  </p>
                </div>
                {!report.revokedAt && (
                  <div className="flex gap-2">
                    <Link
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                      })}
                      href={`/business-outcomes/report/${report.id}`}
                    >
                      <ArrowUpRight className="size-4" />
                      Open report
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRevokeId(report.id)}
                    >
                      Revoke
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}
      <ConfirmDialog
        open={!!revokeId}
        onOpenChange={(v) => {
          if (!v) setRevokeId("");
        }}
        title="Revoke this report?"
        description="The published link will stop working. Downloaded copies cannot be recalled."
        confirmLabel="Revoke report"
        variant="destructive"
        onConfirm={async () => {
          const result = await revokeOutcomeReportAction(study.id, revokeId);
          setRevokeId("");
          if (result.error) toast.error(result.error);
          else {
            toast.success("Report revoked");
            refresh();
          }
        }}
      />
    </div>
  );
}
