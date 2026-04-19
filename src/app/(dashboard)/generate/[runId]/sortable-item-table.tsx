"use client"

import React, { useState, useCallback, useMemo } from "react"
import { AlertTriangle, ArrowUp, ArrowDown, ArrowUpDown, Info } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { subthemeColor, wtoInterpretation, difficultyColor, sdRiskColor, difficultyOrdinal, sdRiskOrdinal } from "./metric-helpers"
import type { GeneratedItem } from "@/types/database"

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

function statusRank(item: GeneratedItem): number {
  if (item.isAccepted) return 3
  if (item.removalStage === "kept" || (!item.isRedundant && !item.isUnstable)) return 2
  if (item.removalStage === "boot_ega") return 1
  if (item.removalStage === "uva") return 0
  return 2
}

function statusBadge(item: GeneratedItem): React.ReactNode {
  if (item.isAccepted) return <Badge variant="outline">Accepted</Badge>
  if (item.removalStage === "uva") {
    return (
      <Badge variant="destructive">
        UVA{item.removalSweep ? ` S${item.removalSweep}` : ""}
      </Badge>
    )
  }
  if (item.removalStage === "boot_ega") {
    return (
      <Badge variant="secondary">
        bootEGA{item.removalSweep ? ` S${item.removalSweep}` : ""}
      </Badge>
    )
  }
  return <Badge variant="default">Suggested</Badge>
}

function finalCommunityId(item: GeneratedItem): number | undefined {
  return item.finalCommunityId ?? item.communityId ?? item.initialCommunityId
}

// ---------------------------------------------------------------------------
// Sort header
// ---------------------------------------------------------------------------

type SortKey = "wto" | "stability" | "community" | "status" | "facet" | "difficulty" | "sdRisk"
type SortDir = "asc" | "desc"

function SortHeader({
  label,
  sortKey: key,
  currentKey,
  currentDir,
  onSort,
  tooltip,
}: {
  label: string
  sortKey: SortKey
  currentKey: SortKey
  currentDir: SortDir
  onSort: (key: SortKey) => void
  tooltip?: string
}) {
  const active = key === currentKey
  return (
    <th
      className="px-3 py-2 text-left text-xs font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors whitespace-nowrap"
      onClick={() => onSort(key)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {tooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={<span className="inline-flex" />}
              >
                <Info className="size-3 text-muted-foreground/60" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                {tooltip}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {active ? (
          currentDir === "asc" ? (
            <ArrowUp className="size-3" />
          ) : (
            <ArrowDown className="size-3" />
          )
        ) : (
          <ArrowUpDown className="size-3 opacity-40" />
        )}
      </span>
    </th>
  )
}

// ---------------------------------------------------------------------------
// Sub-theme pill
// ---------------------------------------------------------------------------

function SubthemePill({ item }: { item: GeneratedItem }) {
  const communityId = finalCommunityId(item)
  if (communityId == null || communityId === 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger render={<span className="inline-flex" />}>
            <span className="text-xs text-muted-foreground">—</span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs">
            {item.removalStage && item.removalStage !== "kept"
              ? "This item was filtered out before the final network view, so it has no retained sub-theme assignment."
              : "No sub-theme assigned. This can happen if the network was too sparse for community detection."}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  const colors = subthemeColor(communityId)

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<span className="inline-flex" />}>
          <span
            className="inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-medium tabular-nums min-w-[1.5rem]"
            style={{ background: colors.bg, color: colors.text }}
          >
            {communityId}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          <div className="space-y-1">
            {item.initialCommunityId !== undefined && <p>Initial community: {item.initialCommunityId}</p>}
            {item.finalCommunityId !== undefined && <p>Final community: {item.finalCommunityId}</p>}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ---------------------------------------------------------------------------
// SortableItemTable
// ---------------------------------------------------------------------------

export function SortableItemTable({
  items,
  selectedIds,
  onToggleSelect,
  isMultiConstruct,
  itemRefs,
}: {
  items: GeneratedItem[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  isMultiConstruct: boolean
  itemRefs: React.RefObject<Map<string, HTMLTableRowElement | null>>
}) {
  const [sortKey, setSortKey] = useState<SortKey>("wto")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"))
      } else {
        setSortDir(key === "wto" ? "asc" : key === "stability" ? "desc" : "asc")
      }
      return key
    })
  }, [])

  const sorted = useMemo(() => {
    const arr = [...items]
    arr.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case "wto":
          cmp = (a.wtoMax ?? 0) - (b.wtoMax ?? 0)
          break
        case "stability":
          cmp = (a.bootStability ?? 0) - (b.bootStability ?? 0)
          break
        case "community":
          cmp = (finalCommunityId(a) ?? 0) - (finalCommunityId(b) ?? 0)
          break
        case "status":
          cmp = statusRank(a) - statusRank(b)
          break
        case "facet":
          cmp = (a.facet ?? "").localeCompare(b.facet ?? "")
          break
        case "difficulty":
          cmp = difficultyOrdinal(a.difficultyTier) - difficultyOrdinal(b.difficultyTier)
          break
        case "sdRisk":
          cmp = sdRiskOrdinal(a.sdRisk) - sdRiskOrdinal(b.sdRisk)
          break
      }
      return sortDir === "desc" ? -cmp : cmp
    })
    return arr
  }, [items, sortKey, sortDir])

  return (
    <div className="overflow-x-auto rounded-lg bg-card ring-1 ring-foreground/[0.06]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50 bg-muted/30">
            <th className="w-10 px-3 py-2" />
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
              Item Stem
            </th>
            <th className="w-10 px-3 py-2 text-center text-xs font-medium text-muted-foreground" title="Reverse-scored">
              Key
            </th>
            <SortHeader
              label="Sub-theme"
              sortKey="community"
              currentKey={sortKey}
              currentDir={sortDir}
              onSort={handleSort}
              tooltip="Semantic sub-cluster discovered by network analysis. Items in the same sub-theme measure related facets of the construct."
            />
            <SortHeader
              label="Facet"
              sortKey="facet"
              currentKey={sortKey}
              currentDir={sortDir}
              onSort={handleSort}
              tooltip="The narrow behavioural facet this item taps, as labelled by the LLM during generation."
            />
            <SortHeader
              label="Diff."
              sortKey="difficulty"
              currentKey={sortKey}
              currentDir={sortDir}
              onSort={handleSort}
              tooltip="Difficulty tier: how easy the item is to endorse. Easy = most agree, Hard = only strong scorers agree."
            />
            <SortHeader
              label="SD"
              sortKey="sdRisk"
              currentKey={sortKey}
              currentDir={sortDir}
              onSort={handleSort}
              tooltip="Social desirability risk. Low = neutral, High = strongly desirable/undesirable wording."
            />
            <SortHeader
              label="wTO"
              sortKey="wto"
              currentKey={sortKey}
              currentDir={sortDir}
              onSort={handleSort}
              tooltip="Weighted Topological Overlap measures redundancy. Lower = more unique. Below 0.10 is excellent; above 0.20 suggests the item overlaps too much with neighbours."
            />
            {isMultiConstruct && (
              <SortHeader
                label="Stability"
                sortKey="stability"
                currentKey={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
                tooltip="How consistently this item clusters with the same construct across 100 bootstrap resamples. Above 0.75 is reliable."
              />
            )}
            <SortHeader
              label="Status"
              sortKey="status"
              currentKey={sortKey}
              currentDir={sortDir}
              onSort={handleSort}
            />
          </tr>
        </thead>
        <tbody>
          {sorted.map((item) => {
            const isSelected = selectedIds.has(item.id)
            const dimmed = item.removalStage === "uva" || item.removalStage === "boot_ega"
            const wto = item.wtoMax !== undefined ? wtoInterpretation(item.wtoMax) : null
            const communityShifted =
              item.initialCommunityId !== undefined &&
              item.finalCommunityId !== undefined &&
              item.initialCommunityId !== item.finalCommunityId

            return (
              <tr
                key={item.id}
                ref={(el) => { itemRefs.current?.set(item.id, el) }}
                className={`border-b border-border/30 last:border-0 transition-colors ${
                  dimmed ? "opacity-50" : ""
                } ${isSelected ? "bg-primary/5" : "hover:bg-muted/20"}`}
              >
                {/* Checkbox */}
                <td className="px-3 py-2.5 align-top">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleSelect(item.id)}
                    disabled={!!item.isAccepted}
                    aria-label="Select item"
                  />
                </td>

                {/* Stem */}
                <td className={`px-3 py-2.5 align-top max-w-md ${item.removalStage === "uva" ? "line-through text-muted-foreground" : ""}`}>
                  <p className="text-sm leading-snug">{item.stem}</p>
                  {item.removalStage && item.removalStage !== "kept" && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Removed in {item.removalStage === "uva" ? "UVA" : "bootEGA"}
                      {item.removalSweep ? ` sweep ${item.removalSweep}` : ""}.
                    </p>
                  )}
                  {communityShifted && !dimmed && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Community realigned from {item.initialCommunityId} to {item.finalCommunityId}.
                    </p>
                  )}
                </td>

                {/* Keying */}
                <td className="px-3 py-2.5 align-top text-center">
                  {item.reverseScored && (
                    <Badge variant="outline" className="text-xs h-5">R</Badge>
                  )}
                </td>

                {/* Sub-theme — numbered pill */}
                <td className="px-3 py-2.5 align-top">
                  <SubthemePill item={item} />
                </td>

                {/* Facet */}
                <td className="px-3 py-2.5 align-top">
                  {item.facet && (
                    <span className="text-xs text-muted-foreground">{item.facet}</span>
                  )}
                </td>

                {/* Difficulty */}
                <td className="px-3 py-2.5 align-top">
                  {item.difficultyTier && (() => {
                    const d = difficultyColor(item.difficultyTier)
                    return (
                      <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ${d.className}`}>
                        {d.label}
                      </span>
                    )
                  })()}
                </td>

                {/* SD Risk */}
                <td className="px-3 py-2.5 align-top">
                  {item.sdRisk && (() => {
                    const s = sdRiskColor(item.sdRisk)
                    return (
                      <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ${s.className}`}>
                        {s.label}
                      </span>
                    )
                  })()}
                </td>

                {/* wTO — colour-coded */}
                <td className="px-3 py-2.5 align-top">
                  {item.wtoMax !== undefined && (
                    <span className={`text-xs tabular-nums font-medium ${wto?.className ?? ""}`}>
                      {item.wtoMax > 0.2 && (
                        <AlertTriangle className="size-3 inline mr-0.5" />
                      )}
                      {item.wtoMax.toFixed(3)}
                    </span>
                  )}
                </td>

                {/* Stability (multi-construct only) */}
                {isMultiConstruct && (
                  <td className="px-3 py-2.5 align-top">
                    {item.bootStability !== undefined && (
                      <span
                        className={`text-xs tabular-nums ${
                          item.bootStability < 0.75
                            ? "text-amber-600 font-medium"
                            : "text-muted-foreground"
                        }`}
                      >
                        {item.bootStability < 0.75 && (
                          <AlertTriangle className="size-3 inline mr-0.5" />
                        )}
                        {item.bootStability.toFixed(3)}
                      </span>
                    )}
                  </td>
                )}

                {/* Status */}
                <td className="px-3 py-2.5 align-top">{statusBadge(item)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
