"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronRight,
  Wand2,
  ArrowLeft,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import {
  getConstructsForGeneration,
  getResponseFormatsForGeneration,
  createGenerationRun,
  startGenerationRun,
} from "@/app/actions/generation";
import { FALLBACK_MODELS } from "@/lib/ai/providers/openrouter";
import type { GenerationRunConfig } from "@/types/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Construct = Awaited<ReturnType<typeof getConstructsForGeneration>>[number];
type ResponseFormat = Awaited<
  ReturnType<typeof getResponseFormatsForGeneration>
>[number];

interface WizardConfig {
  selectedConstructIds: string[];
  targetItemsPerConstruct: number;
  temperature: number;
  generationModel: string;
  embeddingModel: string;
  responseFormatId?: string;
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

const STEPS = [
  { number: 1, label: "Select Constructs" },
  { number: 2, label: "Readiness Check" },
  { number: 3, label: "Configure" },
  { number: 4, label: "Launch" },
] as const;

function StepIndicator({
  currentStep,
  maxReached,
  onStepClick,
}: {
  currentStep: number;
  maxReached: number;
  onStepClick: (step: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {STEPS.map((step) => {
        const isActive = step.number === currentStep;
        const isDone = step.number < currentStep;
        const isEnabled = step.number <= maxReached;

        return (
          <button
            key={step.number}
            onClick={() => isEnabled && onStepClick(step.number)}
            disabled={!isEnabled}
            className={[
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : isDone
                  ? "text-foreground hover:bg-muted cursor-pointer"
                  : isEnabled
                    ? "text-muted-foreground hover:bg-muted cursor-pointer"
                    : "text-muted-foreground/40 cursor-not-allowed",
            ].join(" ")}
          >
            <div
              className={[
                "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : isDone
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border bg-transparent text-muted-foreground",
              ].join(" ")}
            >
              {isDone ? <CheckCircle2 className="size-3.5" /> : step.number}
            </div>
            <span className="text-sm font-medium">{step.label}</span>
            {isActive && <ChevronRight className="ml-auto size-4 opacity-60" />}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: Select Constructs
// ---------------------------------------------------------------------------

function Step1SelectConstructs({
  constructs,
  selectedIds,
  onToggle,
  onNext,
}: {
  constructs: Construct[] | null;
  selectedIds: string[];
  onToggle: (id: string) => void;
  onNext: () => void;
}) {
  // Group by dimensionName
  const grouped = React.useMemo(() => {
    if (!constructs) return new Map<string, Construct[]>();
    const map = new Map<string, Construct[]>();
    for (const c of constructs) {
      const key = c.dimensionName ?? "Other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return map;
  }, [constructs]);

  const isLoading = constructs === null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Select Constructs</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose the constructs you want to generate items for. At least one construct is required.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
          <Loader2 className="size-4 animate-spin" />
          Loading constructs...
        </div>
      ) : grouped.size === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No active constructs found. Create and activate constructs in the Library first.
          </p>
        </div>
      ) : (
        <div className="space-y-6 max-h-[520px] overflow-y-auto pr-1">
          {Array.from(grouped.entries()).map(([dimension, items]) => (
            <div key={dimension}>
              <p className="text-overline text-muted-foreground mb-2">{dimension}</p>
              <div className="grid gap-2">
                {items.map((construct) => {
                  const isSelected = selectedIds.includes(construct.id);
                  return (
                    <label
                      key={construct.id}
                      className={[
                        "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                        isSelected
                          ? "border-primary/50 bg-primary/5"
                          : "border-border hover:border-primary/30 hover:bg-muted/50",
                      ].join(" ")}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggle(construct.id)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">{construct.name}</span>
                          <Badge variant="outline" className="text-caption">
                            {construct.existingItemCount}{" "}
                            {construct.existingItemCount === 1 ? "item" : "items"}
                          </Badge>
                        </div>
                        {construct.definition && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {construct.definition}
                          </p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <span className="text-sm text-muted-foreground">
          {selectedIds.length === 0
            ? "No constructs selected"
            : `${selectedIds.length} construct${selectedIds.length !== 1 ? "s" : ""} selected`}
        </span>
        <Button onClick={onNext} disabled={selectedIds.length === 0}>
          Next: Check Readiness
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: Readiness Check
// ---------------------------------------------------------------------------

function Step2ReadinessCheck({
  constructs,
  selectedIds,
  onBack,
  onNext,
}: {
  constructs: Construct[] | null;
  selectedIds: string[];
  onBack: () => void;
  onNext: () => void;
}) {
  const selected = React.useMemo(
    () => (constructs ?? []).filter((c) => selectedIds.includes(c.id)),
    [constructs, selectedIds],
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Readiness Check</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Verifying that selected constructs have sufficient definition for item generation.
        </p>
      </div>

      <div className="space-y-2">
        {selected.map((construct) => (
          <div
            key={construct.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
          >
            <CheckCircle2 className="size-5 shrink-0 text-green-500" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{construct.name}</p>
              <p className="text-xs text-muted-foreground">Definition is clear and distinct</p>
            </div>
            <Badge variant="outline" className="text-green-600 border-green-200 dark:border-green-800">
              Ready
            </Badge>
          </div>
        ))}
      </div>

      {selected.length > 0 && (
        <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 flex items-center gap-2">
          <CheckCircle2 className="size-4 text-primary shrink-0" />
          <p className="text-sm text-primary font-medium">
            All {selected.length} construct{selected.length !== 1 ? "s" : ""} passed readiness checks
          </p>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Button onClick={onNext}>
          Proceed to Configuration
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Configure
// ---------------------------------------------------------------------------

function Step3Configure({
  config,
  responseFormats,
  onChange,
  onBack,
  onNext,
}: {
  config: WizardConfig;
  responseFormats: ResponseFormat[] | null;
  onChange: (patch: Partial<WizardConfig>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Configure Generation</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Tune the generation parameters before launching the pipeline.
        </p>
      </div>

      <div className="space-y-6">
        {/* Items per construct */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Items per Construct</label>
            <span className="text-sm font-semibold text-primary tabular-nums">
              {config.targetItemsPerConstruct}
            </span>
          </div>
          <Slider
            min={20}
            max={80}
            value={[config.targetItemsPerConstruct]}
            onValueChange={(v) =>
              onChange({ targetItemsPerConstruct: Array.isArray(v) ? v[0] : v })
            }
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>20</span>
            <span>80</span>
          </div>
        </div>

        {/* Temperature */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Generation Temperature</label>
            <span className="text-sm font-semibold text-primary tabular-nums">
              {config.temperature.toFixed(1)}
            </span>
          </div>
          <Slider
            min={0.5}
            max={1.5}
            step={0.1}
            value={[config.temperature]}
            onValueChange={(v) => {
              const n = Array.isArray(v) ? v[0] : v;
              onChange({ temperature: Math.round(n * 10) / 10 });
            }}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0.5 — Focused</span>
            <span>1.5 — Diverse</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Higher values produce more diverse items but may increase redundancy. The pipeline
            filters redundant items automatically.
          </p>
        </div>

        {/* Generation model */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Generation Model</label>
          <Select
            value={config.generationModel}
            onValueChange={(v) => { if (v) onChange({ generationModel: v }); }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FALLBACK_MODELS.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Embedding model — read-only */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Embedding Model</label>
          <div className="flex h-8 items-center rounded-lg border border-border bg-muted/40 px-2.5 text-sm text-muted-foreground">
            {config.embeddingModel}
          </div>
        </div>

        {/* Response format */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Response Format (Optional)</label>
          <Select
            value={config.responseFormatId ?? "__none__"}
            onValueChange={(v) => {
              if (v !== null) onChange({ responseFormatId: v === "__none__" ? undefined : v });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {(responseFormats ?? []).map((rf) => (
                <SelectItem key={rf.id} value={rf.id}>
                  {rf.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Items will be linked to this response format when accepted into the library.
          </p>
          {!config.responseFormatId && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 dark:border-amber-800 dark:bg-amber-950/30">
              <AlertCircle className="size-4 shrink-0 text-amber-600 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Without a response format, generated items cannot be accepted into the library.
                You can still review them but won't be able to save them.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Button onClick={onNext}>
          Next: Review &amp; Launch
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4: Review & Launch
// ---------------------------------------------------------------------------

function Step4Launch({
  config,
  constructs,
  responseFormats,
  onBack,
  onLaunch,
  isLaunching,
}: {
  config: WizardConfig;
  constructs: Construct[] | null;
  responseFormats: ResponseFormat[] | null;
  onBack: () => void;
  onLaunch: () => void;
  isLaunching: boolean;
}) {
  const selectedConstructs = (constructs ?? []).filter((c) =>
    config.selectedConstructIds.includes(c.id),
  );
  const selectedFormat = (responseFormats ?? []).find(
    (rf) => rf.id === config.responseFormatId,
  );
  const selectedModel = FALLBACK_MODELS.find((m) => m.id === config.generationModel);
  const totalItems = config.selectedConstructIds.length * config.targetItemsPerConstruct;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Review &amp; Launch</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Confirm your configuration before starting the generation pipeline.
        </p>
      </div>

      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-sm">Generation Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Selected Constructs</p>
            <div className="flex flex-wrap gap-1.5">
              {selectedConstructs.map((c) => (
                <Badge key={c.id} variant="outline">
                  {c.name}
                </Badge>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Target Items</p>
              <p className="font-semibold">
                {config.selectedConstructIds.length} constructs × {config.targetItemsPerConstruct} ={" "}
                <span className="text-primary">{totalItems} total</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Temperature</p>
              <p className="font-semibold">{config.temperature.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Model</p>
              <p className="font-semibold">{selectedModel?.name ?? config.generationModel}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Response Format</p>
              <p className="font-semibold">{selectedFormat?.name ?? "None"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={onBack} disabled={isLaunching}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Button onClick={onLaunch} disabled={isLaunching} className="min-w-36">
          {isLaunching ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Launching...
            </>
          ) : (
            <>
              <Wand2 className="size-4" />
              Generate Items
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main wizard page
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: WizardConfig = {
  selectedConstructIds: [],
  targetItemsPerConstruct: 60,
  temperature: 0.8,
  generationModel: "anthropic/claude-sonnet-4-5",
  embeddingModel: "openai/text-embedding-3-small",
  responseFormatId: undefined,
};

export default function NewGenerationPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [step, setStep] = useState(1);
  const [maxReached, setMaxReached] = useState(1);
  const [config, setConfig] = useState<WizardConfig>(DEFAULT_CONFIG);

  const [constructs, setConstructs] = useState<Construct[] | null>(null);
  const [responseFormats, setResponseFormats] = useState<ResponseFormat[] | null>(null);

  // Fetch constructs and response formats on mount
  useEffect(() => {
    getConstructsForGeneration()
      .then(setConstructs)
      .catch(() => toast.error("Failed to load constructs"));
    getResponseFormatsForGeneration()
      .then(setResponseFormats)
      .catch(() => toast.error("Failed to load response formats"));
  }, []);

  function patchConfig(patch: Partial<WizardConfig>) {
    setConfig((prev) => ({ ...prev, ...patch }));
  }

  function toggleConstruct(id: string) {
    setConfig((prev) => {
      const ids = prev.selectedConstructIds.includes(id)
        ? prev.selectedConstructIds.filter((x) => x !== id)
        : [...prev.selectedConstructIds, id];
      return { ...prev, selectedConstructIds: ids };
    });
  }

  function goToStep(n: number) {
    setStep(n);
    if (n > maxReached) setMaxReached(n);
  }

  function handleLaunch() {
    startTransition(async () => {
      try {
        const runConfig: GenerationRunConfig = {
          constructIds: config.selectedConstructIds,
          targetItemsPerConstruct: config.targetItemsPerConstruct,
          temperature: config.temperature,
          generationModel: config.generationModel,
          embeddingModel: config.embeddingModel,
          responseFormatId: config.responseFormatId,
        };

        const run = await createGenerationRun(runConfig);
        const result = await startGenerationRun(run.id);

        if (!result.success) {
          toast.error(result.error ?? "Failed to start generation run");
          return;
        }

        toast.success("Generation run started — reviewing results shortly");
        router.push(`/generate/${run.id}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to launch generation run");
      }
    });
  }

  return (
    <div className="max-w-4xl space-y-8">
      <PageHeader eyebrow="AI Tools" title="New Item Generation" />

      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        {/* Left: Step indicator */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <StepIndicator
            currentStep={step}
            maxReached={maxReached}
            onStepClick={goToStep}
          />
        </aside>

        {/* Right: Step content */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          {step === 1 && (
            <Step1SelectConstructs
              constructs={constructs}
              selectedIds={config.selectedConstructIds}
              onToggle={toggleConstruct}
              onNext={() => goToStep(2)}
            />
          )}
          {step === 2 && (
            <Step2ReadinessCheck
              constructs={constructs}
              selectedIds={config.selectedConstructIds}
              onBack={() => goToStep(1)}
              onNext={() => goToStep(3)}
            />
          )}
          {step === 3 && (
            <Step3Configure
              config={config}
              responseFormats={responseFormats}
              onChange={patchConfig}
              onBack={() => goToStep(2)}
              onNext={() => goToStep(4)}
            />
          )}
          {step === 4 && (
            <Step4Launch
              config={config}
              constructs={constructs}
              responseFormats={responseFormats}
              onBack={() => goToStep(3)}
              onLaunch={handleLaunch}
              isLaunching={isPending}
            />
          )}
        </div>
      </div>
    </div>
  );
}
