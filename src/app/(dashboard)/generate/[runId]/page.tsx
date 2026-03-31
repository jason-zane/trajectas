"use client"

import React, { use, useEffect, useRef, useState, useCallback, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  AlertTriangle,
  CheckSquare,
  Square,
  RefreshCw,
  Download,
  BookOpen,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

import {
  getGenerationRun,
  acceptGeneratedItems,
  getConstructsForGeneration,
  rerunGenerationRun,
  cancelGenerationRun,
  exportRunItemsAsCSV,
} from "@/app/actions/generation"
import type { GenerationRun, GeneratedItem } from "@/types/database"

import { constructColor } from "./metric-helpers"
import { NetworkGraph } from "./network-graph"
import { SortableItemTable } from "./sortable-item-table"
import { QualityPanel } from "./quality-panel"
import { PipelineExplainerSheet } from "./pipeline-explainer-sheet"

// ---------------------------------------------------------------------------
// Pipeline step definitions
// ---------------------------------------------------------------------------

const PIPELINE_STEPS = [
  { key: "preflight", label: "Pre-flight Check", description: "Validate constructs and config" },
  { key: "item_generation", label: "Item Generation", description: "Generate candidate items with LLM" },
  { key: "embedding", label: "Embedding", description: "Compute semantic embeddings" },
  { key: "initial_ega", label: "Network Analysis (EGA)", description: "Exploratory graph analysis" },
  { key: "uva", label: "Redundancy Removal", description: "Unique variable analysis (UVA)" },
  { key: "boot_ega", label: "Stability Check", description: "Bootstrap EGA for stability" },
  { key: "final", label: "Review Ready", description: "Items ready for human review" },
] as const

type PipelineStepKey = (typeof PIPELINE_STEPS)[number]["key"]

// ---------------------------------------------------------------------------
// ProgressView
// ---------------------------------------------------------------------------

function ProgressView({ run, onCancel }: { run: GenerationRun; onCancel: () => void }) {
  const currentStepKey = run.currentStep as PipelineStepKey | undefined

  const currentStepIndex = currentStepKey
    ? PIPELINE_STEPS.findIndex((s) => s.key === currentStepKey)
    : -1

  function stepState(index: number): "done" | "current" | "future" {
    if (index < currentStepIndex) return "done"
    if (index === currentStepIndex) return "current"
    return "future"
  }

  return (
    <div className="flex gap-6 max-w-4xl">
      {/* Step indicator panel */}
      <div className="w-56 shrink-0 rounded-xl bg-card ring-1 ring-foreground/[0.06] shadow-sm p-5 space-y-1">
        <p className="text-overline text-primary mb-4">Pipeline Steps</p>
        {PIPELINE_STEPS.map((step, i) => {
          const state = stepState(i)
          return (
            <div key={step.key} className="flex items-start gap-3 py-2">
              <div className="mt-0.5 shrink-0">
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
              <div>
                <p
                  className={`text-sm font-medium leading-snug ${
                    state === "future"
                      ? "text-muted-foreground/60"
                      : state === "current"
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </p>
                {state === "current" && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {step.description}
                  </p>
                )}
              </div>
            </div>
          )
        })}

        <div className="pt-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-caption text-muted-foreground">Progress</span>
            <span className="text-caption font-medium">{run.progressPct}%</span>
          </div>
          <Progress value={run.progressPct} />
        </div>
      </div>

      {/* Stats panel */}
      <div className="flex-1 rounded-xl bg-card ring-1 ring-foreground/[0.06] shadow-sm p-6 space-y-6">
        <div>
          <p className="text-overline text-primary mb-3">Run Status</p>
          <div className="grid grid-cols-2 gap-4">
            <StatBlock label="Status" value={run.status} />
            <StatBlock label="Items Generated" value={String(run.itemsGenerated)} />
            {run.modelUsed && <StatBlock label="Model" value={run.modelUsed} />}
            {run.currentStep && <StatBlock label="Current Step" value={run.currentStep} />}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin shrink-0" />
            <span>Generation pipeline is running… polling every 2 seconds.</span>
          </div>
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel Run
          </Button>
        </div>
      </div>
    </div>
  )
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <p className="text-caption text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold mt-0.5 truncate">{value}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ReviewView
// ---------------------------------------------------------------------------

function ReviewView({
  run,
  items,
  constructNameMap,
}: {
  run: GenerationRun
  items: GeneratedItem[]
  constructNameMap: Map<string, string>
}) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isAccepting, setIsAccepting] = useState(false)
  const [isRerunning, startRerun] = useTransition()
  const [isExporting, startExport] = useTransition()
  const itemRefs = useRef<Map<string, HTMLTableRowElement | null>>(new Map())

  const suggestedItems = items.filter((i) => !i.isRedundant && !i.isUnstable)

  const handleSelectAllSuggested = useCallback(() => {
    setSelectedIds(new Set(suggestedItems.filter((i) => !i.isAccepted).map((i) => i.id)))
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
      toast.success(`${result.accepted} item${result.accepted !== 1 ? "s" : ""} saved to library`)
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
        const blob = new Blob([result.csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
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

  // Group items by construct
  const byConstruct = new Map<string, GeneratedItem[]>()
  for (const constructId of run.config.constructIds) {
    byConstruct.set(constructId, [])
  }
  for (const item of items) {
    if (!byConstruct.has(item.constructId)) {
      byConstruct.set(item.constructId, [])
    }
    byConstruct.get(item.constructId)!.push(item)
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Quality summary + network — side by side on large screens */}
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <QualityPanel run={run} items={items} suggestedCount={suggestedItems.length} />

        <NetworkGraph
          items={items}
          constructIds={run.config.constructIds}
          constructNameMap={constructNameMap}
          onItemClick={handleItemClick}
        />
      </div>

      {/* Bulk actions toolbar */}
      <div className="sticky top-0 z-10 flex items-center gap-3 rounded-xl bg-card/95 backdrop-blur ring-1 ring-foreground/[0.06] shadow-sm px-4 py-3">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSelectAllSuggested}
          className="gap-1.5"
        >
          <CheckSquare className="size-3.5" />
          Select All Suggested
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearSelection}
          className="gap-1.5"
        >
          <Square className="size-3.5" />
          Clear
        </Button>
        <span className="text-sm text-muted-foreground ml-2">
          {selectedIds.size > 0
            ? `${selectedIds.size} item${selectedIds.size !== 1 ? "s" : ""} selected`
            : "No items selected"}
        </span>
        <span className="flex-1" />
        {!hasResponseFormat && (
          <span className="text-xs text-amber-500 flex items-center gap-1">
            <AlertTriangle className="size-3.5" />
            No response format — cannot save items
          </span>
        )}
      </div>

      {/* Item review table(s) grouped by construct */}
      {run.config.constructIds.map((constructId, ci) => {
        const constructItems = byConstruct.get(constructId) ?? []
        const passing = constructItems.filter((i) => !i.isRedundant && !i.isUnstable).length
        const passPct =
          constructItems.length > 0
            ? Math.round((passing / constructItems.length) * 100)
            : 0
        const name = constructNameMap.get(constructId) ?? constructId

        return (
          <div key={constructId} className="space-y-2">
            <div className="flex items-center gap-3">
              <span
                className="size-2.5 rounded-full shrink-0 inline-block"
                style={{ background: constructColor(ci) }}
              />
              <span className="font-semibold text-sm">{name}</span>
              <span className="text-caption text-muted-foreground">
                {constructItems.length} items · {passing} suggested ({passPct}%)
              </span>
            </div>
            {constructItems.length === 0 ? (
              <p className="text-sm text-muted-foreground px-4 py-3">
                No items generated for this construct.
              </p>
            ) : (
              <SortableItemTable
                items={constructItems}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                isMultiConstruct={run.config.constructIds.length >= 2}
                itemRefs={itemRefs}
              />
            )}
          </div>
        )
      })}

      {/* Sticky accept bar */}
      <div className="sticky bottom-0 z-10 mt-4">
        <div className="bg-card/95 backdrop-blur ring-1 ring-foreground/[0.06] shadow-lg rounded-xl px-5 py-3 flex items-center gap-4">
          <div className="flex-1">
            {!hasResponseFormat ? (
              <p className="text-sm text-amber-500 flex items-center gap-1.5">
                <AlertTriangle className="size-4" />
                Select a response format to accept items
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {selectedIds.size > 0
                  ? `${selectedIds.size} item${selectedIds.size !== 1 ? "s" : ""} ready to save`
                  : "Select items above to add them to your library"}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={isExporting}
            className="gap-1.5"
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
            onClick={handleRerun}
            disabled={isRerunning}
            className="gap-1.5"
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
              <TooltipTrigger
                render={<span className="inline-flex" />}
              >
                <span className={selectedIds.size === 0 || !hasResponseFormat ? "cursor-not-allowed inline-flex" : "inline-flex"}>
                  <Button
                    onClick={handleAccept}
                    disabled={selectedIds.size === 0 || !hasResponseFormat || isAccepting}
                  >
                    {isAccepting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      <>
                        Save {selectedIds.size} {selectedIds.size === 1 ? 'Item' : 'Items'} to Library
                      </>
                    )}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {!hasResponseFormat
                  ? "No response format selected in the generation config"
                  : selectedIds.size === 0
                  ? "Select at least one item to save"
                  : `Save ${selectedIds.size} item${selectedIds.size !== 1 ? "s" : ""} to your library`}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Error view
// ---------------------------------------------------------------------------

function FailedView({ run }: { run: GenerationRun }) {
  return (
    <div className="rounded-xl bg-destructive/10 ring-1 ring-destructive/20 p-6 max-w-lg flex items-start gap-3">
      <AlertCircle className="size-5 text-destructive shrink-0 mt-0.5" />
      <div>
        <p className="font-semibold text-destructive">Generation failed</p>
        <p className="text-sm text-muted-foreground mt-1">
          {run.errorMessage ?? "An unknown error occurred during the generation pipeline."}
        </p>
      </div>
    </div>
  )
}

const TERMINAL_STATUSES = new Set(["reviewing", "completed", "failed"])

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function GenerationRunPage({
  params,
}: {
  params: Promise<{ runId: string }>
}) {
  const { runId } = use(params)

  const [run, setRun] = useState<GenerationRun | null>(null)
  const [items, setItems] = useState<GeneratedItem[]>([])
  const [constructNameMap, setConstructNameMap] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [explainerOpen, setExplainerOpen] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async () => {
    const result = await getGenerationRun(runId)
    if (!result) return

    setRun(result.run)
    setItems(result.items)
    setLoading(false)

    if (TERMINAL_STATUSES.has(result.run.status)) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [runId])

  useEffect(() => {
    getConstructsForGeneration().then((constructs) => {
      const map = new Map<string, string>()
      for (const c of constructs) {
        map.set(c.id, c.name)
      }
      setConstructNameMap(map)
    })
  }, [])

  useEffect(() => {
    const initialFetchTimer = window.setTimeout(() => {
      void fetchData()
    }, 0)

    pollingRef.current = setInterval(() => {
      void fetchData()
    }, 2000)

    return () => {
      window.clearTimeout(initialFetchTimer)
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [fetchData])

  if (loading || !run) {
    return (
      <div className="space-y-8 max-w-6xl">
        <div className="flex items-center gap-3 text-muted-foreground text-sm">
          <Loader2 className="size-4 animate-spin" />
          Loading run data…
        </div>
      </div>
    )
  }

  const isReviewing = run.status === "reviewing" || run.status === "completed"
  const isFailed = run.status === "failed"

  const constructNames = run.config.constructIds.map(
    (id) => constructNameMap.get(id) ?? id,
  )
  const pageTitle =
    constructNames.length <= 3 ? constructNames.join(", ") : `${constructNames.length} Constructs`

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        eyebrow="Item Generator"
        title={pageTitle}
        description={
          isReviewing
            ? "Review and accept generated items into your library."
            : isFailed
            ? "The generation pipeline encountered an error."
            : "Generation pipeline is running…"
        }
      >
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={() => setExplainerOpen(true)}
        >
          <BookOpen className="size-3.5" />
          How It Works
        </Button>
      </PageHeader>

      <PipelineExplainerSheet open={explainerOpen} onOpenChange={setExplainerOpen} />

      {isFailed && <FailedView run={run} />}
      {!isFailed && isReviewing && (
        <ReviewView run={run} items={items} constructNameMap={constructNameMap} />
      )}
      {!isFailed && !isReviewing && (
        <ProgressView
          run={run}
          onCancel={async () => {
            const result = await cancelGenerationRun(runId)
            if (result.success) {
              toast.error("Run cancelled")
              fetchData()
            } else {
              toast.error(result.error ?? "Failed to cancel run")
            }
          }}
        />
      )}
    </div>
  )
}
