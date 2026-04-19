"use client"

import React from "react"
import { Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { nmiInterpretation, wtoInterpretation } from "./metric-helpers"
import type { GenerationRun, GeneratedItem } from "@/types/database"

function FunnelBar({
  label,
  count,
  maxCount,
  colorClass,
}: {
  label: string
  count: number
  maxCount: number
  colorClass: string
}) {
  const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-caption text-muted-foreground w-28 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-caption font-medium w-8 text-right">{count}</span>
    </div>
  )
}

function NmiRow({
  label,
  value,
  improved,
}: {
  label: string
  value: number
  improved?: boolean
}) {
  const interpretation = nmiInterpretation(value)
  return (
    <div className="flex items-center gap-2">
      <span className="text-caption text-muted-foreground w-28 shrink-0">
        {label}
        {improved && <span className="ml-1 text-primary">▲</span>}
      </span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${interpretation.barClass}`}
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
      <span className="text-caption w-10 text-right tabular-nums">
        {value.toFixed(2)}
      </span>
      <span className={`text-caption w-16 ${interpretation.className}`}>
        {interpretation.label}
      </span>
    </div>
  )
}

const WTO_RANGES = [
  { max: 0.10, ...wtoInterpretation(0.05) },
  { max: 0.20, ...wtoInterpretation(0.15) },
  { max: 0.30, ...wtoInterpretation(0.25) },
  { max: Infinity, ...wtoInterpretation(0.35) },
]

function MetricGuide({ isMultiConstruct }: { isMultiConstruct: boolean }) {
  return (
    <div>
      <p className="text-overline text-primary mb-2">Reading the Metrics</p>
      <div className="space-y-3">
        <div>
          <p className="text-xs font-medium text-foreground mb-1.5">wTO (Redundancy)</p>
          <div className="space-y-1">
            {WTO_RANGES.map((range, index) => (
              <div key={index} className="flex items-center gap-2 text-xs">
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  range.label === "Excellent" ? "bg-emerald-500" :
                  range.label === "Good" ? "bg-muted-foreground" :
                  range.label === "Marginal" ? "bg-amber-500" :
                  "bg-red-500"
                }`} />
                <span className="text-muted-foreground w-14 shrink-0">
                  {range.max === Infinity ? "> 0.30" : range.max === 0.10 ? "< 0.10" : `≤ ${range.max.toFixed(2)}`}
                </span>
                <span className={range.className}>{range.label}</span>
              </div>
            ))}
          </div>
        </div>

        {isMultiConstruct && (
          <div>
            <p className="text-xs font-medium text-foreground mb-1.5">Stability</p>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-muted-foreground w-14 shrink-0">≥ 0.90</span>
                <span className="text-emerald-600">Excellent</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                <span className="text-muted-foreground w-14 shrink-0">≥ 0.75</span>
                <span className="text-primary">Good</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                <span className="text-muted-foreground w-14 shrink-0">{"< 0.75"}</span>
                <span className="text-amber-600">Unstable</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function buildQualityWarnings({
  isMulti,
  generatedCount,
  keptCount,
  removedByUva,
  removedByBoot,
  finalNmi,
  initialNmi,
}: {
  isMulti: boolean
  generatedCount: number
  keptCount: number
  removedByUva: number
  removedByBoot: number
  finalNmi?: number
  initialNmi?: number
}): string[] {
  const warnings: string[] = []

  if (generatedCount > 0 && removedByUva / generatedCount >= 0.35) {
    warnings.push("A large share of the pool was removed as redundant, which usually means the generator is producing near-duplicate content rather than genuinely distinct indicators.")
  }

  const stablePool = generatedCount - removedByUva
  if (stablePool > 0 && removedByBoot / stablePool >= 0.25) {
    warnings.push("Many items changed community under bootstrap resampling. That usually indicates weak construct boundaries or item wording that can plausibly belong to multiple constructs.")
  }

  if (isMulti && finalNmi !== undefined && finalNmi < 0.75) {
    warnings.push("Final NMI is still below a robust separation threshold, so the surviving item pool is not clearly partitioning along the intended constructs.")
  }

  if (
    isMulti &&
    finalNmi !== undefined &&
    initialNmi !== undefined &&
    finalNmi + 0.02 < initialNmi
  ) {
    warnings.push("Filtering reduced construct alignment instead of improving it. That points to over-aggressive removals or unstable clustering before the filter decisions were made.")
  }

  if (generatedCount > 0 && keptCount / generatedCount <= 0.4) {
    warnings.push("Less than 40% of generated items survived the pipeline. The final pool may be too thin for good content coverage even if the remaining items are cleaner.")
  }

  return warnings
}

export function QualityPanel({
  run,
  items,
  suggestedCount,
}: {
  run: GenerationRun
  items: GeneratedItem[]
  suggestedCount: number
}) {
  const maxCount = run.itemsGenerated || 1
  const afterUva = run.itemsAfterUva ?? run.itemsGenerated
  const afterBoot = run.itemsAfterBoot ?? afterUva
  const isMulti = run.config.constructIds.length >= 2

  const removedByUva = items.filter((item) => item.removalStage === "uva").length
  const removedByBoot = items.filter((item) => item.removalStage === "boot_ega").length
  const keptItems = items.filter((item) => !(item.isRedundant || item.isUnstable))
  const subthemeCount = new Set(
    keptItems.map((item) => item.finalCommunityId ?? item.communityId).filter((communityId) => communityId != null),
  ).size

  const nmiByStage = run.aiSnapshot?.nmiByStage
  const finalNmi = nmiByStage?.final ?? run.nmiFinal
  const initialNmi = nmiByStage?.initial ?? run.nmiInitial
  const finalInterpretation = finalNmi !== undefined ? nmiInterpretation(finalNmi) : null
  const qualityWarnings = buildQualityWarnings({
    isMulti,
    generatedCount: run.itemsGenerated,
    keptCount: keptItems.length,
    removedByUva,
    removedByBoot,
    finalNmi,
    initialNmi,
  })

  return (
    <div className="rounded-xl bg-card ring-1 ring-foreground/[0.06] shadow-sm p-5 space-y-5">
      <div>
        <p className="text-overline text-primary mb-3">Quality Funnel</p>
        <div className="space-y-3">
          <FunnelBar label="Generated" count={run.itemsGenerated} maxCount={maxCount} colorClass="bg-primary/60" />
          <FunnelBar label="After UVA" count={afterUva} maxCount={maxCount} colorClass="bg-primary/70" />
          <FunnelBar label="After bootEGA" count={afterBoot} maxCount={maxCount} colorClass="bg-primary/80" />
          <FunnelBar label="Suggested" count={suggestedCount} maxCount={maxCount} colorClass="bg-primary" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div>Removed by UVA: <span className="font-medium text-foreground">{removedByUva}</span></div>
          <div>Removed by bootEGA: <span className="font-medium text-foreground">{removedByBoot}</span></div>
        </div>
      </div>

      {isMulti ? (
        initialNmi !== undefined && (
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <p className="text-overline text-primary">Construct Alignment (NMI)</p>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger render={<span className="inline-flex" />}>
                    <Info className="size-3 text-muted-foreground/60" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    Normalised Mutual Information compares discovered communities with the intended construct labels. Higher is better; 1.0 is perfect agreement.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="space-y-2">
              <NmiRow label="All items" value={initialNmi} />
              {nmiByStage?.postUva !== undefined && <NmiRow label="After UVA" value={nmiByStage.postUva} improved={nmiByStage.postUva > initialNmi} />}
              {nmiByStage?.postEmbeddingSelection !== undefined && <NmiRow label="Embedding choice" value={nmiByStage.postEmbeddingSelection} improved={nmiByStage.postEmbeddingSelection > initialNmi} />}
              {finalNmi !== undefined && <NmiRow label="Final set" value={finalNmi} improved={finalNmi > initialNmi} />}
            </div>
            {finalNmi !== undefined ? (
              <p className="text-xs text-muted-foreground mt-2">
                The final NMI should normally hold steady or improve after redundant and unstable items are removed.
              </p>
            ) : (
              <p className="text-xs text-amber-600 mt-2">
                Later-stage NMI was not recomputed because too few items survived filtering for a meaningful final network.
              </p>
            )}
            {finalInterpretation && (
              <p className={`text-xs mt-2 ${finalInterpretation.className}`}>
                {finalInterpretation.summary}
              </p>
            )}
          </div>
        )
      ) : (
        <div>
          <p className="text-overline text-primary mb-3">Dimensionality</p>
          <p className="text-xs text-muted-foreground">
            The retained pool contains <span className="font-medium text-foreground">{subthemeCount}</span> semantic sub-theme{subthemeCount === 1 ? "" : "s"}.
            That is expected for a single construct: you want coverage across facets, not just repeated wording of one narrow behaviour.
          </p>
        </div>
      )}

      {qualityWarnings.length > 0 && (
        <div>
          <p className="text-overline text-primary mb-2">Why Results May Be Weak</p>
          <div className="space-y-2 text-xs text-muted-foreground">
            {qualityWarnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-overline text-primary mb-2">Selecting Items</p>
        <div className="space-y-2 text-xs text-muted-foreground">
          <p>
            Sort by <span className="font-medium text-foreground">wTO</span> ascending to find the most unique items first. Low wTO means the item adds information instead of echoing a neighbour.
          </p>
          <p>
            Spread selections across different <span className="font-medium text-foreground">sub-themes</span> so the final library samples more than one semantic facet.
          </p>
          {isMulti && (
            <p>
              Treat <span className="font-medium text-foreground">stability</span> below 0.75 as a warning that the item does not sit reliably inside one construct.
            </p>
          )}
        </div>
      </div>

      <MetricGuide isMultiConstruct={isMulti} />

      <div className="space-y-2 pt-2 border-t border-border/50">
        {run.modelUsed && (
          <div className="flex justify-between gap-3">
            <span className="text-caption text-muted-foreground">Model</span>
            <span className="text-caption font-medium truncate max-w-40">{run.modelUsed}</span>
          </div>
        )}
        {run.aiSnapshot?.embeddingType && (
          <div className="flex justify-between gap-3">
            <span className="text-caption text-muted-foreground">Embedding view</span>
            <span className="text-caption font-medium uppercase">{run.aiSnapshot.embeddingType}</span>
          </div>
        )}
        {run.aiSnapshot?.networkEstimator && (
          <div className="flex justify-between gap-3">
            <span className="text-caption text-muted-foreground">Network estimator</span>
            <span className="text-caption font-medium uppercase">{run.aiSnapshot.networkEstimator}</span>
          </div>
        )}
        {run.aiSnapshot?.walktrapStep !== undefined && (
          <div className="flex justify-between gap-3">
            <span className="text-caption text-muted-foreground">Walktrap step</span>
            <span className="text-caption font-medium">{run.aiSnapshot.walktrapStep}</span>
          </div>
        )}
        {run.aiSnapshot?.uvaSweeps !== undefined && (
          <div className="flex justify-between gap-3">
            <span className="text-caption text-muted-foreground">UVA sweeps</span>
            <span className="text-caption font-medium">{run.aiSnapshot.uvaSweeps}</span>
          </div>
        )}
        {run.aiSnapshot?.bootSweeps !== undefined && (
          <div className="flex justify-between gap-3">
            <span className="text-caption text-muted-foreground">bootEGA sweeps</span>
            <span className="text-caption font-medium">{run.aiSnapshot.bootSweeps}</span>
          </div>
        )}
      </div>
    </div>
  )
}
