"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Wand2, AlertTriangle } from "lucide-react";

import {
  ActionDialog,
  ActionWizard,
  type ActionWizardStep,
} from "@/components/action-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  extractBrief,
  runArchitectMatch,
  createArchitectAssessment,
} from "@/app/actions/architect";
import { ARCHITECT_SECONDS_PER_ITEM, type ArchitectMatchResult } from "@/types/architect";
import type { AssessmentLevel, AssessmentOutcome, Brief } from "@/types/ai";

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
  const [chipId, setChipId] = useState<string>("selection");
  const [brief, setBrief] = useState<Brief | null>(null);
  const [match, setMatch] = useState<ArchitectMatchResult | null>(null);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const chip = OUTCOME_CHIPS.find((c) => c.id === chipId) ?? OUTCOME_CHIPS[0];
  const currentStepIndex = Math.max(0, WIZARD_STEPS.findIndex((s) => s.id === stepId));

  const includedPicks = picks.filter((p) => p.included);
  const totalItems = includedPicks.reduce((sum, p) => sum + p.availableItems, 0);
  const estMinutes = Math.max(1, Math.round((totalItems * ARCHITECT_SECONDS_PER_ITEM) / 60));

  function reset() {
    setStepId("brief");
    setBusy(false);
    setRawText("");
    setChipId("selection");
    setBrief(null);
    setMatch(null);
    setPicks([]);
    setTitle("");
    setDescription("");
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
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
      } catch (error) {
        toast.error("Couldn't read the role", { description: errorMessage(error, "Try adding more detail.") });
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
        const result = await runArchitectMatch({ brief });
        setMatch(result);
        setPicks(
          result.picks.map((p, i) => ({
            ...p,
            included: i < (result.recommendedCount.optimal || result.picks.length),
          })),
        );
      } catch (error) {
        toast.error("Matching failed", { description: errorMessage(error, "Please try again.") });
        goTo("review", "right");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (stepId === "picks") {
      goTo("name");
    }
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
        picks: includedPicks.map((p) => ({ factorId: p.factorId, itemCount: p.availableItems, weight: 1 })),
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
              <Label htmlFor="arch-text">Role description</Label>
              <Textarea
                id="arch-text"
                placeholder="Paste a position description, or describe the role in your own words — responsibilities, seniority, function, context…"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={9}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Paste or type for now — file upload (PDF/DOCX) is coming soon.
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
                          <div className="flex items-center gap-2">
                            <h4 className="truncate font-medium">{p.factorName}</h4>
                            <Badge variant="outline" className="shrink-0 text-[10px]">
                              {Math.round(p.relevanceScore)}% match
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{p.reasoning}</p>
                          <p className="mt-1.5 text-[11px] text-muted-foreground/80">
                            {p.availableItems} items
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
