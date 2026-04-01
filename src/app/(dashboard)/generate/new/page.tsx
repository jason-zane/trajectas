"use client";

import React, { useState, useEffect, useTransition, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
  checkConstructReadiness,
} from "@/app/actions/generation";
import { getModelSelectionBootstrap } from "@/app/actions/model-config";
import type { GenerationRunConfig } from "@/types/database";
import type { ConstructDraftInput, PreflightResult } from "@/types/generation";
import { ModelPickerCombobox } from "@/app/(dashboard)/settings/models/model-picker-combobox";
import type { OpenRouterModel } from "@/types/generation";

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
  promptPurpose: 'item_generation' | 'factor_item_generation';
}

interface WizardModelBootstrap {
  configuredModels: Partial<Record<string, string>>;
  textModels: OpenRouterModel[];
  embeddingModels: OpenRouterModel[];
}

interface ConstructDraftState {
  definition: string;
  description: string;
  indicatorsLow: string;
  indicatorsMid: string;
  indicatorsHigh: string;
}

type DraftField = keyof ConstructDraftState;
type ConstructDraftMap = Record<string, ConstructDraftState>;

function createConstructDraftState(construct?: Partial<Construct>): ConstructDraftState {
  return {
    definition: construct?.definition ?? "",
    description: construct?.description ?? "",
    indicatorsLow: construct?.indicatorsLow ?? "",
    indicatorsMid: construct?.indicatorsMid ?? "",
    indicatorsHigh: construct?.indicatorsHigh ?? "",
  };
}

function normalizeDraftText(value: string): string | undefined {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function buildPreflightConstructs(
  constructs: Construct[] | null,
  selectedIds: string[],
  drafts: ConstructDraftMap,
): ConstructDraftInput[] {
  return (constructs ?? [])
    .filter((construct) => selectedIds.includes(construct.id))
    .map((construct) => {
      const draft = drafts[construct.id] ?? createConstructDraftState(construct);
      return {
        id: construct.id,
        name: construct.name,
        definition: normalizeDraftText(draft.definition),
        description: normalizeDraftText(draft.description),
        indicatorsLow: normalizeDraftText(draft.indicatorsLow),
        indicatorsMid: normalizeDraftText(draft.indicatorsMid),
        indicatorsHigh: normalizeDraftText(draft.indicatorsHigh),
      };
    });
}

function buildConstructOverrides(
  constructs: Construct[] | null,
  selectedIds: string[],
  drafts: ConstructDraftMap,
): GenerationRunConfig["constructOverrides"] {
  const overrides: NonNullable<GenerationRunConfig["constructOverrides"]> = {};

  for (const construct of constructs ?? []) {
    if (!selectedIds.includes(construct.id)) continue;
    const draft = drafts[construct.id] ?? createConstructDraftState(construct);
    const patch: NonNullable<GenerationRunConfig["constructOverrides"]>[string] = {};

    if (draft.definition !== (construct.definition ?? "")) patch.definition = draft.definition;
    if (draft.description !== (construct.description ?? "")) patch.description = draft.description;
    if (draft.indicatorsLow !== (construct.indicatorsLow ?? "")) patch.indicatorsLow = draft.indicatorsLow;
    if (draft.indicatorsMid !== (construct.indicatorsMid ?? "")) patch.indicatorsMid = draft.indicatorsMid;
    if (draft.indicatorsHigh !== (construct.indicatorsHigh ?? "")) patch.indicatorsHigh = draft.indicatorsHigh;

    if (Object.keys(patch).length > 0) {
      overrides[construct.id] = patch;
    }
  }

  return Object.keys(overrides).length > 0 ? overrides : undefined;
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
  constructDrafts,
  onDraftChange,
  onBack,
  onNext,
}: {
  constructs: Construct[] | null;
  selectedIds: string[];
  constructDrafts: ConstructDraftMap;
  onDraftChange: (constructId: string, field: DraftField, value: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const selected = React.useMemo(
    () => (constructs ?? []).filter((c) => selectedIds.includes(c.id)),
    [constructs, selectedIds],
  );
  const selectedConstructInputs = React.useMemo(
    () => buildPreflightConstructs(constructs, selectedIds, constructDrafts),
    [constructs, selectedIds, constructDrafts],
  );

  const [preflightResult, setPreflightResult] = React.useState<PreflightResult | null>(null);
  const [preflightError, setPreflightError] = React.useState<string | null>(null);
  const [preflightLoading, setPreflightLoading] = React.useState(true);
  const [lastCheckedSignature, setLastCheckedSignature] = React.useState("");

  // Map construct IDs to their preflight status from pairs
  const constructStatus = React.useMemo((): Map<string, "green" | "amber" | "red"> => {
    const map = new Map<string, "green" | "amber" | "red">();
    if (!preflightResult) return map;
    for (const pair of preflightResult.pairs) {
      const existingA = map.get(pair.constructAId);
      const existingB = map.get(pair.constructBId);
      const worse = (
        a: "green" | "amber" | "red" | undefined,
        b: "green" | "amber" | "red",
      ): "green" | "amber" | "red" => {
        if (a === "red" || b === "red") return "red";
        if (a === "amber" || b === "amber") return "amber";
        return "green";
      };
      map.set(pair.constructAId, worse(existingA, pair.status));
      map.set(pair.constructBId, worse(existingB, pair.status));
    }
    return map;
  }, [preflightResult]);

  const readinessSignature = React.useMemo(
    () => JSON.stringify(selectedConstructInputs),
    [selectedConstructInputs],
  );
  const readinessNeedsRefresh = readinessSignature !== lastCheckedSignature;
  const reviewedPairs = React.useMemo(
    () => [...(preflightResult?.pairs ?? [])]
      .filter((pair) => pair.reviewedByLlm || pair.status !== "green")
      .sort((left, right) => right.cosineSimilarity - left.cosineSimilarity),
    [preflightResult],
  );

  const runReadinessCheck = React.useCallback((constructInputs: ConstructDraftInput[]) => {
    setPreflightLoading(true);
    setPreflightError(null);
    setPreflightResult(null);
    const signature = JSON.stringify(constructInputs);
    checkConstructReadiness(constructInputs)
      .then((res) => {
        if (res.success) {
          setPreflightResult(res.result);
          setLastCheckedSignature(signature);
        } else {
          setPreflightError(res.error ?? "Readiness check failed");
        }
      })
      .catch((err) => {
        setPreflightError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setPreflightLoading(false);
      });
  }, []);

  useEffect(() => {
    if (selectedConstructInputs.length === 0) {
      setPreflightLoading(false);
      setPreflightResult(null);
      setPreflightError(null);
      setLastCheckedSignature("");
      return;
    }

    runReadinessCheck(selectedConstructInputs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds.join(","), constructs]);

  const overallStatus = preflightResult?.overallStatus ?? "green";
  const metadata = preflightResult?.metadata;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Readiness Check</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Verifying that selected constructs have sufficient definition for item generation.
        </p>
      </div>

      {preflightLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
          <Loader2 className="size-4 animate-spin" />
          Running readiness check…
        </div>
      ) : preflightError ? (
        <>
          <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 p-3 flex items-start gap-2">
            <AlertCircle className="size-4 shrink-0 text-red-600 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-medium text-red-700 dark:text-red-400">
                Readiness check failed
              </p>
              <p className="text-xs text-red-700 dark:text-red-400">
                {preflightError}
              </p>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-2">
            {selected.map((construct) => {
              const status = constructStatus.get(construct.id) ?? "green";
              const isAmber = status === "amber";
              const isRed = status === "red";
              return (
                <div
                  key={construct.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                >
                  {isRed ? (
                    <AlertCircle className="size-5 shrink-0 text-red-500" />
                  ) : isAmber ? (
                    <AlertCircle className="size-5 shrink-0 text-amber-500" />
                  ) : (
                    <CheckCircle2 className="size-5 shrink-0 text-green-500" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{construct.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {isRed
                        ? "High overlap with another construct — may produce redundant items"
                        : isAmber
                          ? "Some similarity detected — review before proceeding"
                          : "Definition is clear and distinct"}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      isRed
                        ? "text-red-600 border-red-200 dark:border-red-800"
                        : isAmber
                          ? "text-amber-600 border-amber-200 dark:border-amber-800"
                          : "text-green-600 border-green-200 dark:border-green-800"
                    }
                  >
                    {isRed ? "At risk" : isAmber ? "Review" : "Ready"}
                  </Badge>
                </div>
              );
            })}
          </div>

          {preflightResult && (
            <div className="space-y-3">
              <div
                className={[
                  "rounded-lg p-3 flex items-center gap-2 border",
                  overallStatus === "red"
                    ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"
                    : overallStatus === "amber"
                      ? "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
                      : "bg-primary/5 border-primary/20",
                ].join(" ")}
              >
                {overallStatus === "green" ? (
                  <CheckCircle2 className="size-4 text-primary shrink-0" />
                ) : (
                  <AlertCircle
                    className={[
                      "size-4 shrink-0",
                      overallStatus === "red" ? "text-red-600" : "text-amber-600",
                    ].join(" ")}
                  />
                )}
                <p
                  className={[
                    "text-sm font-medium",
                    overallStatus === "red"
                      ? "text-red-700 dark:text-red-400"
                      : overallStatus === "amber"
                        ? "text-amber-700 dark:text-amber-400"
                        : "text-primary",
                  ].join(" ")}
                >
                  {overallStatus === "green"
                    ? `All ${selected.length} construct${selected.length !== 1 ? "s" : ""} passed readiness checks`
                    : overallStatus === "amber"
                      ? "Some constructs have overlapping definitions — you can still proceed"
                      : "One or more constructs have high semantic overlap — consider revising definitions"}
                </p>
              </div>

              {metadata && (
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                  <p>
                    Review threshold: <span className="font-medium text-foreground">{metadata.reviewThreshold?.toFixed(2) ?? metadata.similarityThreshold.toFixed(2)}</span>
                    {" · "}
                    Escalation threshold: <span className="font-medium text-foreground">{metadata.similarityThreshold.toFixed(2)}</span>
                  </p>
                  <p>
                    Pair checks: <span className="font-medium text-foreground">{metadata.pairCount}</span>
                    {" · "}
                    LLM-reviewed pairs: <span className="font-medium text-foreground">{metadata.llmPairCount}</span>
                    {metadata.topPairsReviewed ? (
                      <>
                        {" · "}Top pairs reviewed: <span className="font-medium text-foreground">{metadata.topPairsReviewed}</span>
                      </>
                    ) : null}
                  </p>
                  <p>
                    Embedding model: <span className="font-medium text-foreground">{metadata.embeddingModel}</span>
                  </p>
                  <p>
                    Pre-flight model: <span className="font-medium text-foreground">{metadata.preflightModel ?? "Not needed"}</span>
                    {metadata.promptVersion ? (
                      <>
                        {" · "}Prompt v<span className="font-medium text-foreground">{metadata.promptVersion}</span>
                      </>
                    ) : null}
                  </p>
                </div>
              )}

              {reviewedPairs.length > 0 && (
                <div className="space-y-2">
                  <div>
                    <h3 className="text-sm font-semibold">Pair Diagnostics</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Review the closest construct pairs before you proceed. If you edit definitions below,
                      rerun the readiness check to refresh these diagnostics.
                    </p>
                  </div>
                  <Accordion multiple defaultValue={reviewedPairs.slice(0, 2).map((pair) => `${pair.constructAId}:${pair.constructBId}`)}>
                    {reviewedPairs.map((pair) => (
                      <AccordionItem
                        key={`${pair.constructAId}:${pair.constructBId}`}
                        value={`${pair.constructAId}:${pair.constructBId}`}
                        className="rounded-lg border border-border bg-card"
                      >
                        <AccordionTrigger>
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <span className="text-sm font-medium">
                              {pair.constructAName} vs {pair.constructBName}
                            </span>
                            <Badge variant="outline" className="text-caption">
                              cosine {pair.cosineSimilarity.toFixed(3)}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={
                                pair.status === "red"
                                  ? "border-red-200 text-red-700 dark:border-red-800 dark:text-red-400"
                                  : pair.status === "amber"
                                    ? "border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-400"
                                    : "border-green-200 text-green-700 dark:border-green-800 dark:text-green-400"
                              }
                            >
                              {pair.status === "red" ? "At risk" : pair.status === "amber" ? "Refine" : "Distinct"}
                            </Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionPanel className="px-4 pb-4 space-y-3">
                          {pair.overlapSummary && (
                            <p className="text-sm text-muted-foreground">{pair.overlapSummary}</p>
                          )}
                          {(pair.bigFiveMappingA || pair.bigFiveMappingB) && (
                            <div className="grid gap-3 md:grid-cols-2">
                              {[
                                { name: pair.constructAName, mapping: pair.bigFiveMappingA },
                                { name: pair.constructBName, mapping: pair.bigFiveMappingB },
                              ].map(({ name, mapping }) =>
                                mapping ? (
                                  <div key={name} className="rounded-lg border border-border/70 bg-muted/20 p-2.5 space-y-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-medium">{name}</span>
                                      <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                                        {mapping.primaryDomain}
                                      </Badge>
                                    </div>
                                    {mapping.knownFacetMatch && (
                                      <p className="text-xs text-amber-600 dark:text-amber-400">
                                        Covered by NEO-PI-R: {mapping.knownFacetMatch}
                                      </p>
                                    )}
                                    {mapping.intersectionDomains && mapping.intersectionDomains.length >= 2 && (
                                      <p className="text-xs text-green-600 dark:text-green-400">
                                        Novel intersection: {mapping.intersectionDomains.join(" + ")}
                                      </p>
                                    )}
                                    {mapping.note && (
                                      <p className="text-xs text-muted-foreground">{mapping.note}</p>
                                    )}
                                  </div>
                                ) : null,
                              )}
                            </div>
                          )}
                          {pair.sharedSignals && pair.sharedSignals.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Shared signals</p>
                              <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
                                {pair.sharedSignals.map((signal) => (
                                  <li key={signal}>{signal}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                              <p className="text-sm font-medium">{pair.constructAName}</p>
                              {pair.uniqueSignalsA && pair.uniqueSignalsA.length > 0 && (
                                <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                                  {pair.uniqueSignalsA.map((signal) => (
                                    <li key={signal}>{signal}</li>
                                  ))}
                                </ul>
                              )}
                              {pair.refinementGuidanceA && (
                                <p className="mt-2 text-xs text-muted-foreground">{pair.refinementGuidanceA}</p>
                              )}
                            </div>
                            <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                              <p className="text-sm font-medium">{pair.constructBName}</p>
                              {pair.uniqueSignalsB && pair.uniqueSignalsB.length > 0 && (
                                <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                                  {pair.uniqueSignalsB.map((signal) => (
                                    <li key={signal}>{signal}</li>
                                  ))}
                                </ul>
                              )}
                              {pair.refinementGuidanceB && (
                                <p className="mt-2 text-xs text-muted-foreground">{pair.refinementGuidanceB}</p>
                              )}
                            </div>
                          </div>
                          {(pair.discriminatingItemsA?.length || pair.discriminatingItemsB?.length) ? (
                            <div className="grid gap-3 md:grid-cols-2">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Only {pair.constructAName}</p>
                                <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
                                  {(pair.discriminatingItemsA ?? []).map((item) => (
                                    <li key={item}>{item}</li>
                                  ))}
                                </ul>
                              </div>
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Only {pair.constructBName}</p>
                                <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
                                  {(pair.discriminatingItemsB ?? []).map((item) => (
                                    <li key={item}>{item}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          ) : null}
                          {pair.llmExplanation && (
                            <p className="text-xs text-muted-foreground">{pair.llmExplanation}</p>
                          )}
                        </AccordionPanel>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              )}

              <div className="space-y-2">
                <div>
                  <h3 className="text-sm font-semibold">Refine Definitions</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Edit the wording used for the readiness check and for this generation run. These edits
                    do not overwrite the library definition unless you save them elsewhere later.
                  </p>
                </div>
                <Accordion multiple defaultValue={selected.slice(0, 2).map((construct) => construct.id)}>
                  {selected.map((construct) => {
                    const draft = constructDrafts[construct.id] ?? createConstructDraftState(construct);
                    const status = constructStatus.get(construct.id) ?? "green";
                    return (
                      <AccordionItem
                        key={construct.id}
                        value={construct.id}
                        className="rounded-lg border border-border bg-card"
                      >
                        <AccordionTrigger>
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <span className="text-sm font-medium">{construct.name}</span>
                            <Badge
                              variant="outline"
                              className={
                                status === "red"
                                  ? "border-red-200 text-red-700 dark:border-red-800 dark:text-red-400"
                                  : status === "amber"
                                    ? "border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-400"
                                    : "border-green-200 text-green-700 dark:border-green-800 dark:text-green-400"
                              }
                            >
                              {status === "red" ? "At risk" : status === "amber" ? "Review" : "Ready"}
                            </Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionPanel className="space-y-3 px-4 pb-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Definition</label>
                            <Textarea
                              value={draft.definition}
                              onChange={(event) => onDraftChange(construct.id, "definition", event.target.value)}
                              placeholder="Describe the narrow, stable tendency this construct should capture."
                              rows={4}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</label>
                            <Textarea
                              value={draft.description}
                              onChange={(event) => onDraftChange(construct.id, "description", event.target.value)}
                              placeholder="Add the boundary, centre of gravity, and what this construct is not."
                              rows={5}
                            />
                          </div>
                          <div className="grid gap-3 md:grid-cols-3">
                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Low indicators</label>
                              <Textarea
                                value={draft.indicatorsLow}
                                onChange={(event) => onDraftChange(construct.id, "indicatorsLow", event.target.value)}
                                rows={5}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mid indicators</label>
                              <Textarea
                                value={draft.indicatorsMid}
                                onChange={(event) => onDraftChange(construct.id, "indicatorsMid", event.target.value)}
                                rows={5}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">High indicators</label>
                              <Textarea
                                value={draft.indicatorsHigh}
                                onChange={(event) => onDraftChange(construct.id, "indicatorsHigh", event.target.value)}
                                rows={5}
                              />
                            </div>
                          </div>
                        </AccordionPanel>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </div>
            </div>
          )}
        </>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => runReadinessCheck(selectedConstructInputs)}
            disabled={preflightLoading || selectedConstructInputs.length === 0}
          >
            {preflightLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Running…
              </>
            ) : readinessNeedsRefresh ? (
              "Re-run readiness check"
            ) : (
              "Run again"
            )}
          </Button>
          <Button
            variant={preflightError ? "outline" : "default"}
            onClick={onNext}
            disabled={preflightLoading || readinessNeedsRefresh}
          >
            {readinessNeedsRefresh
              ? "Re-run check to continue"
              : preflightError
                ? "Continue Anyway"
                : "Proceed to Configuration"}
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Configure
// ---------------------------------------------------------------------------

function Step3Configure({
  config,
  textModels,
  embeddingModels,
  responseFormats,
  onChange,
  onBack,
  onNext,
}: {
  config: WizardConfig;
  textModels: OpenRouterModel[];
  embeddingModels: OpenRouterModel[];
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
        {/* Item style */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Item Style</label>
          <Select
            value={config.promptPurpose}
            onValueChange={(v) =>
              onChange({ promptPurpose: v as WizardConfig['promptPurpose'] })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="item_generation">
                Construct
              </SelectItem>
              <SelectItem value="factor_item_generation">
                Factor
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {config.promptPurpose === 'item_generation'
              ? "Narrow construct items — personality-style, measuring dispositions and tendencies."
              : "Broad factor items — behaviour-focused, measuring observable workplace capabilities."}
          </p>
        </div>

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
          <ModelPickerCombobox
            value={config.generationModel}
            onChange={(modelId) => onChange({ generationModel: modelId })}
            models={textModels}
          />
        </div>

        {/* Embedding model */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Embedding Model</label>
          <ModelPickerCombobox
            value={config.embeddingModel}
            onChange={(modelId) => onChange({ embeddingModel: modelId })}
            models={embeddingModels}
          />
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
                You can still review them but won&apos;t be able to save them.
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
        <Button onClick={onNext} disabled={!config.generationModel || !config.embeddingModel}>
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
  constructDrafts,
  textModels,
  embeddingModels,
  responseFormats,
  onBack,
  onLaunch,
  isLaunching,
}: {
  config: WizardConfig;
  constructs: Construct[] | null;
  constructDrafts: ConstructDraftMap;
  textModels: OpenRouterModel[];
  embeddingModels: OpenRouterModel[];
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
  const selectedGenerationModel = textModels.find((m) => m.id === config.generationModel);
  const selectedEmbeddingModel = embeddingModels.find((m) => m.id === config.embeddingModel);
  const totalItems = config.selectedConstructIds.length * config.targetItemsPerConstruct;
  const overrideCount = Object.keys(
    buildConstructOverrides(constructs, config.selectedConstructIds, constructDrafts) ?? {},
  ).length;

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
              <p className="text-xs text-muted-foreground">Item Style</p>
              <p className="font-semibold">
                {config.promptPurpose === 'factor_item_generation'
                  ? 'Factor'
                  : 'Construct'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Temperature</p>
              <p className="font-semibold">{config.temperature.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Target Items</p>
              <p className="font-semibold">
                {config.selectedConstructIds.length} constructs × {config.targetItemsPerConstruct} ={" "}
                <span className="text-primary">{totalItems} total</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Generation Model</p>
              <p className="font-semibold">
                {(selectedGenerationModel?.name ?? config.generationModel) || "Unconfigured"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Embedding Model</p>
              <p className="font-semibold">
                {(selectedEmbeddingModel?.name ?? config.embeddingModel) || "Unconfigured"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Response Format</p>
              <p className="font-semibold">{selectedFormat?.name ?? "None"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Refined Definitions</p>
              <p className="font-semibold">
                {overrideCount === 0
                  ? "None"
                  : `${overrideCount} construct${overrideCount !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={onBack} disabled={isLaunching}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Button
          onClick={onLaunch}
          disabled={isLaunching || !config.generationModel || !config.embeddingModel}
          className="min-w-36"
        >
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
  generationModel: "",
  embeddingModel: "",
  responseFormatId: undefined,
  promptPurpose: 'item_generation',
};

export default function NewGenerationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedConstructId = searchParams.get("constructId");
  const [isPending, startTransition] = useTransition();

  const [step, setStep] = useState(1);
  const [maxReached, setMaxReached] = useState(1);
  const [config, setConfig] = useState<WizardConfig>(DEFAULT_CONFIG);
  const [constructDrafts, setConstructDrafts] = useState<ConstructDraftMap>({});

  const [constructs, setConstructs] = useState<Construct[] | null>(null);
  const [responseFormats, setResponseFormats] = useState<ResponseFormat[] | null>(null);
  const [modelBootstrap, setModelBootstrap] = useState<WizardModelBootstrap | null>(null);

  const patchConfig = useCallback((patch: Partial<WizardConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  // Fetch constructs, response formats, and default models on mount
  useEffect(() => {
    getConstructsForGeneration()
      .then((list) => {
        setConstructs(list);
        setConstructDrafts((prev) => {
          const next = { ...prev };
          for (const construct of list) {
            if (!next[construct.id]) {
              next[construct.id] = createConstructDraftState(construct);
            }
          }
          return next;
        });
        if (preselectedConstructId && list.some((c) => c.id === preselectedConstructId)) {
          patchConfig({ selectedConstructIds: [preselectedConstructId] });
        }
      })
      .catch(() => toast.error("Failed to load constructs"));
    getResponseFormatsForGeneration()
      .then(setResponseFormats)
      .catch(() => toast.error("Failed to load response formats"));
    getModelSelectionBootstrap()
      .then((bootstrap) => {
        setModelBootstrap(bootstrap);
        patchConfig({
          generationModel: bootstrap.configuredModels.item_generation ?? "",
          embeddingModel: bootstrap.configuredModels.embedding ?? "",
        });
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Failed to load model configuration");
      });
  }, [patchConfig, preselectedConstructId]);

  function toggleConstruct(id: string) {
    setConfig((prev) => {
      const ids = prev.selectedConstructIds.includes(id)
        ? prev.selectedConstructIds.filter((x) => x !== id)
        : [...prev.selectedConstructIds, id];
      return { ...prev, selectedConstructIds: ids };
    });
  }

  const patchConstructDraft = useCallback(
    (constructId: string, field: DraftField, value: string) => {
      setConstructDrafts((prev) => ({
        ...prev,
        [constructId]: {
          ...(prev[constructId] ?? createConstructDraftState(constructs?.find((construct) => construct.id === constructId))),
          [field]: value,
        },
      }));
    },
    [constructs],
  );

  function goToStep(n: number) {
    setStep(n);
    if (n > maxReached) setMaxReached(n);
  }

  const [launched, setLaunched] = useState(false);

  function handleLaunch() {
    if (launched) return; // Prevent double-click
    setLaunched(true);

    startTransition(async () => {
      try {
        const runConfig: GenerationRunConfig = {
          constructIds: config.selectedConstructIds,
          targetItemsPerConstruct: config.targetItemsPerConstruct,
          temperature: config.temperature,
          generationModel: config.generationModel,
          embeddingModel: config.embeddingModel,
          responseFormatId: config.responseFormatId,
          promptPurpose: config.promptPurpose,
          constructOverrides: buildConstructOverrides(
            constructs,
            config.selectedConstructIds,
            constructDrafts,
          ),
        };

        const run = await createGenerationRun(runConfig);

        // Kick off the pipeline via API route (not server action) so that
        // client-side navigation doesn't abort the long-running pipeline.
        // We don't await — the detail page polls for progress.
        fetch("/api/generation/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runId: run.id }),
        });

        toast.success("Generation run started");
        router.push(`/generate/${run.id}`);
      } catch (err) {
        setLaunched(false);
        toast.error(err instanceof Error ? err.message : "Failed to launch generation run");
      }
    });
  }

  return (
    <div className="max-w-4xl space-y-8">
      <PageHeader eyebrow="Library" title="New Item Generation" />

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
              constructDrafts={constructDrafts}
              onDraftChange={patchConstructDraft}
              onBack={() => goToStep(1)}
              onNext={() => goToStep(3)}
            />
          )}
          {step === 3 && (
            <Step3Configure
              config={config}
              textModels={modelBootstrap?.textModels ?? []}
              embeddingModels={modelBootstrap?.embeddingModels ?? []}
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
              constructDrafts={constructDrafts}
              textModels={modelBootstrap?.textModels ?? []}
              embeddingModels={modelBootstrap?.embeddingModels ?? []}
              responseFormats={responseFormats}
              onBack={() => goToStep(3)}
              onLaunch={handleLaunch}
              isLaunching={isPending || launched}
            />
          )}
        </div>
      </div>
    </div>
  );
}
