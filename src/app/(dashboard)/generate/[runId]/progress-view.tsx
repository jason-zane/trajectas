"use client"

import React from "react"
import {
  CheckCircle2,
  Circle,
  Loader2,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import type { GenerationRun, GenerationRunConfig } from "@/types/database"

// =============================================================================
// Stage definitions — must mirror the keys emitted by pipeline.ts onProgress
// =============================================================================

interface StageDef {
  key: string
  label: string
  hint: string
}

function buildStages(config: GenerationRunConfig): StageDef[] {
  const stages: StageDef[] = [
    { key: "preflight", label: "Pre-flight", hint: "Validate constructs and run config" },
    { key: "item_generation", label: "Item generation", hint: "LLM writes candidate items per construct" },
  ]
  if (config.enableItemCritique !== false) {
    stages.push({ key: "item_critique", label: "Critique", hint: "A second LLM reviews each batch" })
  }
  stages.push({ key: "embedding", label: "Embedding", hint: "Compute semantic embeddings" })
  if (config.enableLeakageGuard !== false) {
    stages.push({ key: "leakage_check", label: "Leakage guard", hint: "Drop items drifting toward sibling constructs" })
  }
  stages.push(
    { key: "initial_ega", label: "Initial EGA", hint: "Build the item network" },
    { key: "uva", label: "Redundancy (UVA)", hint: "Remove near-duplicate items via wTO" },
    { key: "boot_ega", label: "Stability (BootEGA)", hint: "Resample to find unstable items" },
  )
  if (config.enableSyntheticValidation) {
    stages.push({ key: "synthetic_validation", label: "Synthetic validation", hint: "Simulate respondents to estimate α" })
  }
  stages.push({ key: "final", label: "Ready for review", hint: "Items are ready" })
  return stages
}

function stageState(
  stages: StageDef[],
  current: string | undefined,
  stageKey: string,
): "done" | "current" | "future" {
  if (!current) return "future"
  const ci = stages.findIndex((s) => s.key === current)
  const si = stages.findIndex((s) => s.key === stageKey)
  if (si < ci) return "done"
  if (si === ci) return "current"
  return "future"
}

// =============================================================================
// Top-level
// =============================================================================

export function ProgressView({
  run,
  onCancel,
}: {
  run: GenerationRun
  onCancel: () => void
}) {
  const stages = buildStages(run.config)

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <PipelineStageRail
        stages={stages}
        currentStepKey={run.currentStep}
        progressPct={run.progressPct}
      />

      <div className="space-y-4">
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-overline text-gold">Live</p>
                <p className="text-lg font-semibold">Pipeline running…</p>
                {run.progressDetail && (
                  <p className="text-sm text-muted-foreground">
                    {run.progressDetail}
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCancel}
                className="shrink-0"
              >
                <X className="size-3.5" />
                Cancel run
              </Button>
            </div>

            <RunningStats run={run} />
          </CardContent>
        </Card>

        <PipelineSubStats run={run} />
      </div>
    </div>
  )
}

// =============================================================================
// Stage rail
// =============================================================================

function PipelineStageRail({
  stages,
  currentStepKey,
  progressPct,
}: {
  stages: StageDef[]
  currentStepKey?: string
  progressPct: number
}) {
  return (
    <Card>
      <CardContent className="p-5 space-y-1">
        <p className="text-overline text-gold mb-3">Pipeline</p>
        {stages.map((s, i) => {
          const state = stageState(stages, currentStepKey, s.key)
          const isLast = i === stages.length - 1
          return (
            <div key={s.key} className="relative">
              <div className="flex items-start gap-3 py-2">
                <div
                  className={cn(
                    "mt-0.5 size-5 shrink-0 grid place-items-center",
                  )}
                >
                  {state === "done" && (
                    <CheckCircle2 className="size-4 text-primary" />
                  )}
                  {state === "current" && (
                    <Loader2 className="size-4 text-primary animate-spin" />
                  )}
                  {state === "future" && (
                    <Circle className="size-4 text-muted-foreground/40" />
                  )}
                </div>
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-sm font-medium leading-snug",
                      state === "future" && "text-muted-foreground/60",
                      state === "current" && "text-foreground",
                      state === "done" && "text-muted-foreground",
                    )}
                  >
                    {s.label}
                  </p>
                  {state === "current" && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {s.hint}
                    </p>
                  )}
                </div>
              </div>
              {!isLast && (
                <div className="ml-[10px] h-3 w-px bg-border" />
              )}
            </div>
          )
        })}

        <div className="pt-4 space-y-2 border-t border-border/60 mt-2">
          <div className="flex items-center justify-between">
            <span className="text-caption text-muted-foreground">Progress</span>
            <span className="text-caption font-semibold tabular-nums">
              {progressPct}%
            </span>
          </div>
          <Progress value={progressPct} />
        </div>
      </CardContent>
    </Card>
  )
}

// =============================================================================
// Running stats — large numbers, calm motion
// =============================================================================

function RunningStats({ run }: { run: GenerationRun }) {
  const stages = run.aiSnapshot?.pipelineStages
  const critique = stages?.critique
  const leakage = stages?.leakageGuard
  const tokens = run.tokenUsage
  const totalTokens =
    (typeof tokens?.inputTokens === "number" ? tokens.inputTokens : 0) +
    (typeof tokens?.outputTokens === "number" ? tokens.outputTokens : 0)

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <StatTile
        label="Items generated"
        value={run.itemsGenerated.toString()}
      />
      {critique && (
        <StatTile
          label="Critique kept"
          value={`${critique.kept}/${critique.itemsReviewed}`}
          hint={
            critique.dropped > 0 || critique.revised > 0
              ? `${critique.dropped} dropped · ${critique.revised} revised`
              : undefined
          }
        />
      )}
      {leakage && (
        <StatTile
          label="Leakage flagged"
          value={leakage.flagged.toString()}
          hint={`of ${leakage.itemsChecked} checked`}
        />
      )}
      {totalTokens > 0 && (
        <StatTile
          label="Tokens used"
          value={compactNumber(totalTokens)}
          hint={
            tokens?.inputTokens || tokens?.outputTokens
              ? `${compactNumber(tokens.inputTokens ?? 0)} in · ${compactNumber(tokens.outputTokens ?? 0)} out`
              : undefined
          }
        />
      )}
    </div>
  )
}

function StatTile({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-md bg-cream/40 px-3 py-2.5 border border-border/60">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">
        {label}
      </p>
      <p className="text-lg font-semibold tabular-nums mt-0.5 truncate">
        {value}
      </p>
      {hint && (
        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
          {hint}
        </p>
      )}
    </div>
  )
}

// =============================================================================
// Sub-stats — NMI per stage as it arrives
// =============================================================================

function PipelineSubStats({ run }: { run: GenerationRun }) {
  const nmi = run.aiSnapshot?.nmiByStage
  const stages = run.aiSnapshot?.pipelineStages
  const hasContent =
    !!nmi ||
    !!stages?.syntheticValidation ||
    !!stages?.difficultyTargeting ||
    typeof run.itemsAfterUva === "number" ||
    typeof run.itemsAfterBoot === "number"

  if (!hasContent) return null

  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <p className="text-overline text-gold">Diagnostics as they arrive</p>

        {nmi && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {nmi.initial !== undefined && (
              <SubStat label="NMI initial" value={nmi.initial.toFixed(2)} />
            )}
            {nmi.postUva !== undefined && (
              <SubStat label="NMI post-UVA" value={nmi.postUva.toFixed(2)} />
            )}
            {nmi.postBoot !== undefined && (
              <SubStat label="NMI post-boot" value={nmi.postBoot.toFixed(2)} />
            )}
            {nmi.final !== undefined && (
              <SubStat label="NMI final" value={nmi.final.toFixed(2)} />
            )}
          </div>
        )}

        {(typeof run.itemsAfterUva === "number" ||
          typeof run.itemsAfterBoot === "number") && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <SubStat label="Items generated" value={String(run.itemsGenerated)} />
            {typeof run.itemsAfterUva === "number" && (
              <SubStat label="After UVA" value={String(run.itemsAfterUva)} />
            )}
            {typeof run.itemsAfterBoot === "number" && (
              <SubStat label="After BootEGA" value={String(run.itemsAfterBoot)} />
            )}
          </div>
        )}

        {stages?.syntheticValidation && (
          <SubStat
            label="Synthetic respondents"
            value={String(stages.syntheticValidation.respondentsGenerated)}
          />
        )}
      </CardContent>
    </Card>
  )
}

function SubStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">
        {label}
      </p>
      <p className="text-base font-semibold tabular-nums mt-0.5">{value}</p>
    </div>
  )
}

function compactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}
