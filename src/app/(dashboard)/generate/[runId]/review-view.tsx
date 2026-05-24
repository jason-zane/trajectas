"use client"

import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  AlertTriangle,
  CheckSquare,
  ChevronRight,
  Download,
  Loader2,
  RefreshCw,
  Square,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

import {
  acceptGeneratedItems,
  rerunGenerationRun,
  exportRunItemsAsCSV,
} from "@/app/actions/generation"
import type { GenerationRun, GeneratedItem } from "@/types/database"

import { constructColor } from "./metric-helpers"
import { NetworkGraph } from "./network-graph"
import { SortableItemTable } from "./sortable-item-table"
import { QualityPanel } from "./quality-panel"
import { RunSnapshotTab } from "./run-snapshot-tab"

// =============================================================================
// Top-level review view (post-generation)
// =============================================================================

export function ReviewView({
  run,
  items,
  constructNameMap,
  responseFormatLabel,
}: {
  run: GenerationRun
  items: GeneratedItem[]
  constructNameMap: Map<string, string>
  responseFormatLabel?: string
}) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isAccepting, setIsAccepting] = useState(false)
  const [isRerunning, startRerun] = useTransition()
  const [isExporting, startExport] = useTransition()
  const itemRefs = useRef<Map<string, HTMLTableRowElement | null>>(new Map())

  // Funnel + suggested items
  const funnelStats = useMemo(() => {
    const total = items.length
    const stages = run.aiSnapshot?.pipelineStages
    const droppedByCritique = stages?.critique?.dropped ?? 0
    const droppedByLeakage = items.filter((i) => i.removalStage === "leakage").length
    const droppedByUva = items.filter((i) => i.removalStage === "uva").length
    const droppedByBoot = items.filter((i) => i.removalStage === "boot_ega").length
    const kept = items.filter((i) => i.removalStage === "kept").length
    const totalGenerated = total + droppedByCritique
    return {
      totalGenerated,
      droppedByCritique,
      droppedByLeakage,
      droppedByUva,
      droppedByBoot,
      kept,
    }
  }, [items, run.aiSnapshot])

  const suggestedItems = useMemo(
    () => items.filter((i) => !i.isRedundant && !i.isUnstable),
    [items],
  )

  const handleSelectAllSuggested = useCallback(() => {
    setSelectedIds(
      new Set(suggestedItems.filter((i) => !i.isAccepted).map((i) => i.id)),
    )
  }, [suggestedItems])

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleItemClick = useCallback((itemId: string) => {
    const el = itemRefs.current.get(itemId)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" })
      el.style.outline = "2px solid var(--primary)"
      setTimeout(() => {
        if (el) el.style.outline = ""
      }, 1500)
    }
  }, [])

  const handleAccept = useCallback(async () => {
    if (selectedIds.size === 0) return
    setIsAccepting(true)
    try {
      const result = await acceptGeneratedItems(run.id, Array.from(selectedIds))
      toast.success(
        `${result.accepted} item${result.accepted !== 1 ? "s" : ""} saved to library`,
      )
      setSelectedIds(new Set())
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to accept items"
      toast.error(msg)
    } finally {
      setIsAccepting(false)
    }
  }, [run.id, selectedIds])

  const handleRerun = useCallback(() => {
    startRerun(async () => {
      const result = await rerunGenerationRun(run.id)
      if (result.success && result.newRunId) {
        fetch("/api/generation/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runId: result.newRunId }),
        })
        toast.success("New generation run started")
        router.push(`/generate/${result.newRunId}`)
      } else {
        toast.error(result.error ?? "Failed to start new run")
      }
    })
  }, [run.id, router])

  const handleExportCSV = useCallback(() => {
    startExport(async () => {
      const result = await exportRunItemsAsCSV(run.id)
      if (result.success && result.csv) {
        const blob = new Blob([result.csv], { type: "text/csv" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `items-${run.id.slice(0, 8)}.csv`
        a.click()
        URL.revokeObjectURL(url)
        toast.success("CSV exported")
      } else {
        toast.error(result.error ?? "Failed to export CSV")
      }
    })
  }, [run.id])

  const hasResponseFormat = !!run.config.responseFormatId
  const isMultiConstruct = run.config.constructIds.length >= 2

  // Group items by construct for the Items tab
  const byConstruct = useMemo(() => {
    const map = new Map<string, GeneratedItem[]>()
    for (const constructId of run.config.constructIds) {
      map.set(constructId, [])
    }
    for (const item of items) {
      if (!map.has(item.constructId)) {
        map.set(item.constructId, [])
      }
      map.get(item.constructId)!.push(item)
    }
    return map
  }, [items, run.config.constructIds])

  return (
    <div className="space-y-6">
      <PipelineFunnelStrip stats={funnelStats} />

      <Tabs defaultValue="items" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="items">
            Items
            <span className="ml-2 text-xs text-muted-foreground tabular-nums">
              {funnelStats.kept}/{items.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="network">Network</TabsTrigger>
          <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
          <TabsTrigger value="snapshot">Run snapshot</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="space-y-4 mt-4">
          <BulkActionsBar
            selectedCount={selectedIds.size}
            hasResponseFormat={hasResponseFormat}
            onSelectAll={handleSelectAllSuggested}
            onClear={handleClearSelection}
          />

          {run.config.constructIds.map((constructId, ci) => {
            const constructItems = byConstruct.get(constructId) ?? []
            const passing = constructItems.filter(
              (i) => !i.isRedundant && !i.isUnstable,
            ).length
            const passPct =
              constructItems.length > 0
                ? Math.round((passing / constructItems.length) * 100)
                : 0
            const name = constructNameMap.get(constructId) ?? constructId

            return (
              <ConstructItemGroup
                key={constructId}
                accentColor={constructColor(ci)}
                name={name}
                itemsCount={constructItems.length}
                passing={passing}
                passPct={passPct}
              >
                {constructItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-4 py-3">
                    No items generated for this construct.
                  </p>
                ) : (
                  <SortableItemTable
                    items={constructItems}
                    selectedIds={selectedIds}
                    onToggleSelect={handleToggleSelect}
                    isMultiConstruct={isMultiConstruct}
                    itemRefs={itemRefs}
                  />
                )}
              </ConstructItemGroup>
            )
          })}
        </TabsContent>

        <TabsContent value="network" className="mt-4">
          <Card>
            <CardContent className="p-5">
              <NetworkGraph
                items={items}
                constructIds={run.config.constructIds}
                constructNameMap={constructNameMap}
                onItemClick={handleItemClick}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="diagnostics" className="mt-4">
          <QualityPanel
            run={run}
            items={items}
            suggestedCount={suggestedItems.length}
          />
        </TabsContent>

        <TabsContent value="snapshot" className="mt-4">
          <RunSnapshotTab
            run={run}
            responseFormatLabel={responseFormatLabel}
          />
        </TabsContent>
      </Tabs>

      {/* Sticky save bar */}
      <StickySaveBar
        selectedCount={selectedIds.size}
        hasResponseFormat={hasResponseFormat}
        isAccepting={isAccepting}
        isExporting={isExporting}
        isRerunning={isRerunning}
        onExport={handleExportCSV}
        onRerun={handleRerun}
        onAccept={handleAccept}
      />
    </div>
  )
}

// =============================================================================
// Pipeline funnel strip — read at a glance
// =============================================================================

function PipelineFunnelStrip({
  stats,
}: {
  stats: {
    totalGenerated: number
    droppedByCritique: number
    droppedByLeakage: number
    droppedByUva: number
    droppedByBoot: number
    kept: number
  }
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-overline text-gold mb-2">Pipeline funnel</p>
        <div className="flex items-center gap-2 text-sm flex-wrap tabular-nums">
          <FunnelStep label="generated" value={stats.totalGenerated} primary />
          {stats.droppedByCritique > 0 && (
            <>
              <ChevronRight className="size-3 text-muted-foreground" />
              <FunnelStep label="critique" value={`−${stats.droppedByCritique}`} />
            </>
          )}
          {stats.droppedByLeakage > 0 && (
            <>
              <ChevronRight className="size-3 text-muted-foreground" />
              <FunnelStep label="leakage" value={`−${stats.droppedByLeakage}`} />
            </>
          )}
          <ChevronRight className="size-3 text-muted-foreground" />
          <FunnelStep label="redundancy" value={`−${stats.droppedByUva}`} />
          <ChevronRight className="size-3 text-muted-foreground" />
          <FunnelStep label="instability" value={`−${stats.droppedByBoot}`} />
          <ChevronRight className="size-3 text-muted-foreground" />
          <FunnelStep label="kept" value={stats.kept} accent />
        </div>
      </CardContent>
    </Card>
  )
}

function FunnelStep({
  label,
  value,
  primary,
  accent,
}: {
  label: string
  value: number | string
  primary?: boolean
  accent?: boolean
}) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1",
        primary && "font-medium",
        accent && "font-semibold text-primary",
        !primary && !accent && "text-muted-foreground",
      )}
    >
      <span>{value}</span>
      <span className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
        {label}
      </span>
    </span>
  )
}

// =============================================================================
// Bulk actions bar
// =============================================================================

function BulkActionsBar({
  selectedCount,
  hasResponseFormat,
  onSelectAll,
  onClear,
}: {
  selectedCount: number
  hasResponseFormat: boolean
  onSelectAll: () => void
  onClear: () => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-card/95 backdrop-blur px-4 py-2.5">
      <Button variant="outline" size="sm" onClick={onSelectAll} className="gap-1.5">
        <CheckSquare className="size-3.5" />
        Select all suggested
      </Button>
      <Button variant="ghost" size="sm" onClick={onClear} className="gap-1.5">
        <Square className="size-3.5" />
        Clear
      </Button>
      <span className="text-sm text-muted-foreground ml-2 tabular-nums">
        {selectedCount > 0
          ? `${selectedCount} item${selectedCount !== 1 ? "s" : ""} selected`
          : "No items selected"}
      </span>
      <span className="flex-1" />
      {!hasResponseFormat && (
        <Alert variant="warning" className="py-1.5 px-3 max-w-md">
          <AlertTitle className="text-xs">No rating scale set</AlertTitle>
          <AlertDescription className="text-xs">
            Choose a rating scale on the run to enable saving items.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

// =============================================================================
// Construct group wrapper
// =============================================================================

function ConstructItemGroup({
  accentColor,
  name,
  itemsCount,
  passing,
  passPct,
  children,
}: {
  accentColor: string
  name: string
  itemsCount: number
  passing: number
  passPct: number
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className="size-2.5 rounded-full shrink-0 inline-block"
            style={{ background: accentColor }}
          />
          <span className="font-semibold text-sm">{name}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {itemsCount} items · {passing} suggested ({passPct}%)
          </span>
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

// =============================================================================
// Sticky save bar
// =============================================================================

function StickySaveBar({
  selectedCount,
  hasResponseFormat,
  isAccepting,
  isExporting,
  isRerunning,
  onExport,
  onRerun,
  onAccept,
}: {
  selectedCount: number
  hasResponseFormat: boolean
  isAccepting: boolean
  isExporting: boolean
  isRerunning: boolean
  onExport: () => void
  onRerun: () => void
  onAccept: () => void
}) {
  return (
    <div className="sticky bottom-4 z-10">
      <div
        className="bg-card/95 backdrop-blur ring-1 ring-foreground/[0.08] shadow-lg rounded-xl px-5 py-3 flex items-center gap-4"
        style={{
          transitionTimingFunction: "var(--ease-spring)",
          transitionDuration: "200ms",
        }}
      >
        <div className="flex-1 min-w-0">
          {!hasResponseFormat ? (
            <p className="text-sm text-amber-600 flex items-center gap-1.5">
              <AlertTriangle className="size-4" />
              Choose a rating scale to enable saving items
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {selectedCount > 0
                ? `${selectedCount} item${selectedCount !== 1 ? "s" : ""} ready to save`
                : "Select items above to add them to your library"}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onExport}
          disabled={isExporting}
          className="gap-1.5 shrink-0"
        >
          {isExporting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Download className="size-3.5" />
          )}
          Export CSV
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onRerun}
          disabled={isRerunning}
          className="gap-1.5 shrink-0"
        >
          {isRerunning ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Re-run
        </Button>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger render={<span className="inline-flex" />}>
              <span
                className={
                  selectedCount === 0 || !hasResponseFormat
                    ? "cursor-not-allowed inline-flex"
                    : "inline-flex"
                }
              >
                <Button
                  onClick={onAccept}
                  disabled={
                    selectedCount === 0 || !hasResponseFormat || isAccepting
                  }
                >
                  {isAccepting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Saving…
                    </>
                  ) : (
                    <>
                      Save {selectedCount} {selectedCount === 1 ? "item" : "items"} to
                      library
                    </>
                  )}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {!hasResponseFormat
                ? "No response format selected in the generation config"
                : selectedCount === 0
                  ? "Select at least one item to save"
                  : `Save ${selectedCount} item${selectedCount !== 1 ? "s" : ""} to your library`}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  )
}
