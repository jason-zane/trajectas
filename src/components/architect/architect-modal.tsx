"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Wand2, AlertTriangle, Upload, Loader2, Clock, Layers, Plus } from "lucide-react";

import {
  ActionDialog,
  ActionWizard,
  type ActionWizardStep,
} from "@/components/action-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  extractBrief,
  extractRoleText,
  runArchitectMatch,
  createArchitectAssessment,
  summariseArchitectSelection,
} from "@/app/actions/architect";
import { getItemSelectionRulesForEstimate } from "@/app/actions/item-selection-rules";
import { type ArchitectMatchResult } from "@/types/architect";
import type { AssessmentLevel, AssessmentOutcome, Brief } from "@/types/ai";
import { estimateAssessmentDurationMinutes } from "@/lib/assessments/duration";
import { itemsPerCompetency, fitCountToTime, type ItemRule } from "@/lib/architect/sizing";

// User-facing decision chips. `outcome` is the coarse stored category used for
// eligibility filtering; `intent` is the literal phrasing fed to the matcher's
// reasoning. Selecting a chip is authoritative — it overrides the model's guess.
const OUTCOME_CHIPS: Array<{
  id: string;
  label: string;
  outcome: AssessmentOutcome;
  intent: string;
}> = [
  { id: "selection", label: "Hiring / Selection", outcome: "selection", intent: "selection" },
  { id: "promotion", label: "Promotion readiness", outcome: "selection", intent: "promotion readiness" },
  { id: "succession", label: "Succession planning", outcome: "selection", intent: "succession planning" },
  { id: "development", label: "Development planning", outcome: "development", intent: "development planning" },
  { id: "coaching", label: "Coaching", outcome: "development", intent: "coaching" },
  { id: "team", label: "Team composition", outcome: "team_composition", intent: "team composition" },
];

const LEVEL_LABELS: Record<AssessmentLevel, string> = {
  ic: "Individual contributor",
  first_line_manager: "First-line manager",
  mid_manager: "Mid-level manager",
  senior_leader: "Senior leader",
  executive: "Executive",
};

type StepId = "brief" | "review" | "picks" | "name";

const WIZARD_STEPS: ActionWizardStep[] = [
  { id: "brief", label: "Brief" },
  { id: "review", label: "Review" },
  { id: "picks", label: "Factors" },
  { id: "name", label: "Create" },
];

type Pick = {
  factorId: string;
  factorName: string;
  rank: number;
  relevanceScore: number;
  reasoning: string;
  availableItems: number;
  dimensionId: string | null;
  dimensionName: string | null;
  included: boolean;
};

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  if (error && typeof error === "object") {
    const first = Object.values(error as Record<string, unknown>)
      .flat()
      .find((v) => typeof v === "string");
    if (typeof first === "string") return first;
  }
  return fallback;
}

interface ArchitectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ArchitectModal({ open, onOpenChange }: ArchitectModalProps) {
  const router = useRouter();
  const [stepId, setStepId] = useState<StepId>("brief");
  const [slideDirection, setSlideDirection] = useState<"left" | "right">("left");
  const [busy, setBusy] = useState(false);

  const [rawText, setRawText] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [chipId, setChipId] = useState<string>("selection");
  const [brief, setBrief] = useState<Brief | null>(null);
  const [match, setMatch] = useState<ArchitectMatchResult | null>(null);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [rules, setRules] = useState<ItemRule[]>([]);
  const [targetMinutes, setTargetMinutes] = useState(15);
  const [coverageSummary, setCoverageSummary] = useState<string | null>(null);
  const [summarising, setSummarising] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const chip = OUTCOME_CHIPS.find((c) => c.id === chipId) ?? OUTCOME_CHIPS[0];
  const currentStepIndex = Math.max(0, WIZARD_STEPS.findIndex((s) => s.id === stepId));

  const includedPicks = picks.filter((p) => p.included);
  // Items per competency come from the platform's selection rules, by count — live.
  const perCompetency = itemsPerCompetency(includedPicks.length, rules);
  const itemsFor = (p: Pick) => Math.min(perCompetency, p.availableItems);
  const totalItems = includedPicks.reduce((sum, p) => sum + itemsFor(p), 0);
  const estMinutes = estimateAssessmentDurationMinutes(totalItems);
  const pickedIds = new Set(picks.map((p) => p.factorId));
  const addableFactors = (match?.eligibleFactors ?? []).filter((f) => !pickedIds.has(f.factorId));

  // Length-slider ceiling: all competencies at full rule items.
  const maxTargetMinutes = useMemo(() => {
    const all = picks.map((p) => p.availableItems);
    const per = itemsPerCompetency(all.length, rules);
    const items = all.reduce((s, a) => s + Math.min(per, a), 0);
    return Math.max(5, estimateAssessmentDurationMinutes(items));
  }, [picks, rules]);

  // Computed coverage: what dimensions we're measuring, gaps, and what to add next.
  const coverage = useMemo(() => {
    const incl = picks.filter((p) => p.included);
    const byDim = new Map<string, number>();
    for (const p of incl) {
      const d = p.dimensionName ?? "Other";
      byDim.set(d, (byDim.get(d) ?? 0) + 1);
    }
    const measuring = [...byDim.entries()]
      .map(([dim, n]) => ({ dim, n }))
      .sort((a, b) => b.n - a.n);
    const includedDims = new Set(measuring.map((m) => m.dim));
    const allDims = new Set<string>();
    for (const f of match?.eligibleFactors ?? []) allDims.add(f.dimensionName ?? "Other");
    const gaps = [...allDims].filter((d) => !includedDims.has(d));
    const couldAdd = picks
      .filter((p) => !p.included)
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 3);
    return { measuring, gaps, couldAdd };
  }, [picks, match]);

  function reset() {
    setStepId("brief");
    setBusy(false);
    setRawText("");
    setChipId("selection");
    setBrief(null);
    setMatch(null);
    setPicks([]);
    setTargetMinutes(15);
    setCoverageSummary(null);
    setSummarising(false);
    setTitle("");
    setDescription("");
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const result = await extractRoleText(fd);
      if ("error" in result) {
        toast.error("Couldn't read that file", { description: result.error });
        return;
      }
      if (!result.text) {
        toast.error("No text found in that file", { description: "Try pasting the text instead." });
        return;
      }
      setRawText((prev) => (prev.trim() ? `${prev.trim()}\n\n${result.text}` : result.text));
      toast.success(`Loaded "${file.name}"`);
    } catch {
      toast.error("Upload failed", { description: "Try pasting the text instead." });
    } finally {
      setUploading(false);
    }
  }

  function canAdvance(): boolean {
    if (busy) return false;
    if (stepId === "brief") return rawText.trim().length >= 20;
    if (stepId === "review") return brief !== null;
    if (stepId === "picks") return includedPicks.length > 0;
    if (stepId === "name") return title.trim().length > 0;
    return false;
  }

  function goTo(next: StepId, direction: "left" | "right" = "left") {
    setSlideDirection(direction);
    setStepId(next);
  }

  async function handleNext() {
    if (!canAdvance()) return;

    if (stepId === "brief") {
      // Navigate first so the Review step shows its loading skeleton while we extract.
      goTo("review");
      setBusy(true);
      try {
        const extracted = await extractBrief({
          rawText: rawText.trim(),
          outcomeIntent: chip.intent,
        });
        // The user's chip selection is authoritative for the stored outcome.
        setBrief({ ...extracted, outcome: chip.outcome, outcomeIntent: chip.intent });
        if (!title) setTitle(suggestTitle(extracted.roleTitle, chip.label));
      } catch {
        toast.error("Couldn't read the role", { description: "Check the role description and try again." });
        goTo("brief", "right");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (stepId === "review") {
      if (!brief) return;
      goTo("picks");
      setBusy(true);
      try {
        const [result, fetchedRules] = await Promise.all([
          runArchitectMatch({ brief }),
          getItemSelectionRulesForEstimate(),
        ]);
        setMatch(result);
        setRules(fetchedRules);
        const optimal = result.recommendedCount.optimal || result.picks.length;
        const nextPicks: Pick[] = result.picks.map((p, i) => ({ ...p, included: i < optimal }));
        setPicks(nextPicks);
        // Start the length lever at the recommended selection's duration.
        const inclItems = nextPicks.filter((p) => p.included).map((p) => p.availableItems);
        const per = itemsPerCompetency(inclItems.length, fetchedRules);
        const items = inclItems.reduce((s, a) => s + Math.min(per, a), 0);
        setTargetMinutes(Math.max(5, estimateAssessmentDurationMinutes(items)));
      } catch {
        toast.error("Matching failed", { description: "Please try again in a moment." });
        goTo("review", "right");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (stepId === "picks") {
      goTo("name");
      void generateCoverageSummary();
      return;
    }
  }

  async function generateCoverageSummary() {
    if (!brief) return;
    setSummarising(true);
    setCoverageSummary(null);
    try {
      const included = includedPicks.map((p) => ({
        factorName: p.factorName,
        dimensionName: p.dimensionName,
        rank: p.rank,
      }));
      const excluded = coverage.couldAdd.map((p) => ({
        factorName: p.factorName,
        dimensionName: p.dimensionName,
        rank: p.rank,
      }));
      const result = await summariseArchitectSelection({ brief, included, excluded });
      if ("summary" in result) setCoverageSummary(result.summary);
    } catch {
      // Non-blocking — the computed coverage panel still stands on its own.
    } finally {
      setSummarising(false);
    }
  }

  function applyTargetMinutes(target: number) {
    setTargetMinutes(target);
    const ranked = [...picks].sort((a, b) => a.rank - b.rank);
    const n = fitCountToTime(ranked.map((p) => p.availableItems), target, rules);
    const includeIds = new Set(ranked.slice(0, n).map((p) => p.factorId));
    setPicks((prev) => prev.map((p) => ({ ...p, included: includeIds.has(p.factorId) })));
  }

  function handleBack() {
    const idx = WIZARD_STEPS.findIndex((s) => s.id === stepId);
    const prev = WIZARD_STEPS[idx - 1];
    if (prev) goTo(prev.id as StepId, "right");
  }

  async function handleComplete() {
    if (!canAdvance()) return;
    setBusy(true);
    try {
      const result = await createArchitectAssessment({
        title: title.trim(),
        description: description.trim() || undefined,
        picks: includedPicks.map((p) => ({ factorId: p.factorId, itemCount: itemsFor(p), weight: 1 })),
      });
      if ("error" in result && result.error) {
        throw new Error(errorMessage(result.error, "Unable to create the assessment."));
      }
      handleOpenChange(false);
      toast.success(`"${title.trim()}" created`, {
        description: `${includedPicks.length} factors · ~${estMinutes} min`,
      });
      if ("id" in result && result.id) router.push(`/assessments/${result.id}`);
    } catch (error) {
      toast.error("Couldn't create the assessment", { description: errorMessage(error, "Please try again.") });
    } finally {
      setBusy(false);
    }
  }

  function togglePick(factorId: string) {
    setPicks((prev) => prev.map((p) => (p.factorId === factorId ? { ...p, included: !p.included } : p)));
  }

  function addFactor(factorId: string) {
    const f = match?.eligibleFactors.find((e) => e.factorId === factorId);
    if (!f || picks.some((p) => p.factorId === factorId)) return;
    setPicks((prev) => [
      ...prev,
      {
        factorId: f.factorId,
        factorName: f.factorName,
        rank: prev.length + 1,
        relevanceScore: 0,
        reasoning: "Added manually.",
        availableItems: f.availableItems,
        dimensionId: f.dimensionId,
        dimensionName: f.dimensionName,
        included: true,
      },
    ]);
  }

  return (
    <ActionDialog
      open={open}
      onOpenChange={handleOpenChange}
      eyebrow="Architect"
      title="Design an assessment from a role"
      description="Paste a role description, name the decision, and we'll assemble a tailored draft from your factor library."
      size="xl"
    >
      <ActionWizard
        steps={WIZARD_STEPS}
        currentStepIndex={currentStepIndex}
        onBack={handleBack}
        onNext={handleNext}
        onComplete={handleComplete}
        onCancel={() => handleOpenChange(false)}
        canAdvance={canAdvance()}
        isSubmitting={busy}
        completeLabel="Create assessment"
        completeIcon={<Wand2 className="size-4" />}
        submittingLabel="Creating…"
        slideDirection={slideDirection}
      >
        {stepId === "brief" && (
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="arch-text">Role description</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,application/pdf,text/plain"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleUpload(file);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                  {uploading ? "Reading…" : "Upload PDF / DOCX"}
                </Button>
              </div>
              <Textarea
                id="arch-text"
                placeholder="Paste a position description, or describe the role in your own words — responsibilities, seniority, function, context…"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={9}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Paste, type, or upload a PDF/DOCX/TXT. Uploaded text is appended above so you can edit it.
              </p>
            </div>

            <div className="space-y-2">
              <Label>What decision are you making?</Label>
              <div className="flex flex-wrap gap-2">
                {OUTCOME_CHIPS.map((c) => {
                  const selected = c.id === chipId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setChipId(c.id)}
                      className={cn(
                        "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                        selected
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground hover:border-border/80 hover:bg-muted/40",
                      )}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {stepId === "review" && (
          <div className="space-y-4">
            {busy || !brief ? (
              <BriefSkeleton />
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Here&apos;s how we read the role. Adjust the description and go back if anything looks off.
                </p>
                {brief.confidence === "low" && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                    <span className="text-muted-foreground">
                      The description was a little thin, so this brief is a best guess. Adding more detail will sharpen the match.
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Role" value={brief.roleTitle || "—"} />
                  <Field label="Level" value={LEVEL_LABELS[brief.level]} />
                  <Field label="Function" value={brief.function || "—"} />
                  <Field label="Decision" value={chip.label} />
                </div>
                {brief.responsibilities.length > 0 && (
                  <BulletBlock title="Responsibilities" items={brief.responsibilities} />
                )}
                {brief.contextSignals.length > 0 && (
                  <BulletBlock title="Context" items={brief.contextSignals} />
                )}
                {brief.technicalRequirements.length > 0 && (
                  <BulletBlock title="Technical requirements" items={brief.technicalRequirements} />
                )}
              </>
            )}
          </div>
        )}

        {stepId === "picks" && (
          <div className="space-y-4">
            {busy || !match ? (
              <PicksSkeleton />
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="max-w-2xl text-sm text-muted-foreground">{match.summary}</p>
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="outline">{includedPicks.length} factors</Badge>
                    <Badge variant="outline">{totalItems} items</Badge>
                    <Badge variant="outline">~{estMinutes} min</Badge>
                  </div>
                </div>

                {picks.length > 0 && (
                  <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Clock className="size-4 text-primary" />
                        Target length
                      </div>
                      <span className="text-sm text-muted-foreground">
                        ~{targetMinutes} min · auto-selects competencies
                      </span>
                    </div>
                    <Slider
                      value={[Math.min(targetMinutes, maxTargetMinutes)]}
                      min={3}
                      max={maxTargetMinutes}
                      step={1}
                      onValueChange={(v) =>
                        applyTargetMinutes(Array.isArray(v) ? (v[0] ?? targetMinutes) : v)
                      }
                      className="mt-3"
                    />
                    <p className="mt-1.5 text-[11px] text-muted-foreground/80">
                      Items per competency follow your selection rules ({perCompetency} each now) and
                      shrink as you add more, so the time estimate stays honest. Toggle any below to fine-tune.
                    </p>
                  </div>
                )}

                {picks.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    No factors matched this brief. Go back and add more detail or pick a different decision.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {picks.map((p) => (
                      <div
                        key={p.factorId}
                        className={cn(
                          "flex items-start gap-3 rounded-lg border p-4 transition-colors",
                          p.included ? "border-primary/40 bg-primary/[0.03]" : "border-border opacity-70",
                        )}
                      >
                        <Checkbox
                          checked={p.included}
                          onCheckedChange={() => togglePick(p.factorId)}
                          className="mt-1"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="truncate font-medium">{p.factorName}</h4>
                            {p.dimensionName && (
                              <Badge variant="secondary" className="shrink-0 text-[10px]">
                                {p.dimensionName}
                              </Badge>
                            )}
                            <Badge variant="outline" className="shrink-0 text-[10px]">
                              {Math.round(p.relevanceScore)}% match
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{p.reasoning}</p>
                          <p className="mt-1.5 text-[11px] text-muted-foreground/80">
                            {p.included ? `${itemsFor(p)} items` : `${p.availableItems} available`}
                          </p>
                        </div>
                      </div>
                    ))}

                    {addableFactors.length > 0 && (
                      <Select value="" onValueChange={(v) => v && addFactor(v)}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="+ Add another factor…" />
                        </SelectTrigger>
                        <SelectContent>
                          {addableFactors.map((f) => (
                            <SelectItem key={f.factorId} value={f.factorId}>
                              {f.factorName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}

                {picks.length > 0 && <CoveragePanel coverage={coverage} onInclude={togglePick} />}
              </>
            )}
          </div>
        )}

        {stepId === "name" && (
          <div className="space-y-5">
            <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Sparkles className="size-4 text-primary" />
                {includedPicks.length} factors · {totalItems} items · ~{estMinutes} min
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                <Layers className="size-3.5" />
                What this assessment gives you
              </div>
              {summarising ? (
                <div className="space-y-1.5">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3.5 w-5/6" />
                  <Skeleton className="h-3.5 w-2/3" />
                </div>
              ) : coverageSummary ? (
                <p className="text-sm text-muted-foreground">{coverageSummary}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Measuring {includedPicks.length}{" "}
                  {includedPicks.length === 1 ? "competency" : "competencies"} across{" "}
                  {coverage.measuring.length}{" "}
                  {coverage.measuring.length === 1 ? "area" : "areas"}
                  {coverage.gaps.length > 0 ? `; not covering ${coverage.gaps.join(", ")}.` : "."}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="arch-title">
                Assessment name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="arch-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Senior PM — Selection"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="arch-desc">Description (optional)</Label>
              <Textarea
                id="arch-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A short internal note about this assessment"
                rows={3}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Creates a draft assessment you can refine in the Assessment Builder.
            </p>
          </div>
        )}
      </ActionWizard>
    </ActionDialog>
  );
}

function suggestTitle(roleTitle: string, decisionLabel: string): string {
  const role = roleTitle.trim();
  if (!role) return "";
  return `${role} — ${decisionLabel}`;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-sm font-medium">{value}</div>
    </div>
  );
}

function BulletBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{title}</div>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm text-muted-foreground">
            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary/60" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CoveragePanel({
  coverage,
  onInclude,
}: {
  coverage: {
    measuring: { dim: string; n: number }[];
    gaps: string[];
    couldAdd: Array<{ factorId: string; factorName: string; rank: number; dimensionName: string | null }>;
  };
  onInclude: (factorId: string) => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/10 p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
        <Layers className="size-3.5" /> Coverage
      </div>

      {coverage.measuring.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {coverage.measuring.map((m) => (
            <Badge key={m.dim} variant="secondary" className="text-[10px]">
              {m.dim} · {m.n}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No competencies selected yet.</p>
      )}

      {coverage.gaps.length > 0 && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">Not measuring:</span> {coverage.gaps.join(", ")}
        </p>
      )}

      {coverage.couldAdd.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Could add</div>
          {coverage.couldAdd.map((p) => (
            <div key={p.factorId} className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-xs text-muted-foreground">
                {p.factorName}
                {p.dimensionName ? ` · ${p.dimensionName}` : ""}{" "}
                <span className="text-muted-foreground/60">(#{p.rank})</span>
              </span>
              <Button type="button" variant="ghost" size="xs" onClick={() => onInclude(p.factorId)}>
                <Plus className="size-3" /> Add
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BriefSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-2/3" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

function PicksSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-1/2" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  );
}
