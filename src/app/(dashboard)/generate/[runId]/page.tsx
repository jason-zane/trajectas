"use client"

import React, { use, useEffect, useRef, useState, useCallback, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckSquare,
  Square,
  RefreshCw,
  Download,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionPanel,
} from "@/components/ui/accordion"

import {
  getGenerationRun,
  acceptGeneratedItems,
  getConstructsForGeneration,
  rerunGenerationRun,
  cancelGenerationRun,
  exportRunItemsAsCSV,
} from "@/app/actions/generation"
import type { GenerationRun, GeneratedItem } from "@/types/database"

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
// Colour helpers for constructs / communities
// ---------------------------------------------------------------------------

const CONSTRUCT_HUES = [
  "var(--primary)",
  "hsl(220 70% 50%)",
  "hsl(142 70% 50%)",
  "hsl(38 92% 50%)",
  "hsl(270 60% 55%)",
  "hsl(180 60% 40%)",
  "hsl(340 70% 55%)",
  "hsl(60 80% 45%)",
]

function constructColor(index: number): string {
  return CONSTRUCT_HUES[index % CONSTRUCT_HUES.length]
}

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
// Quality funnel bar
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Network Graph — radial layout
// ---------------------------------------------------------------------------

const SVG_W = 600
const SVG_H = 450
const CX = SVG_W / 2
const CY = SVG_H / 2

interface NodePos {
  x: number
  y: number
  item: GeneratedItem
  constructIndex: number
  communityIndex: number
}

function buildRadialLayout(
  items: GeneratedItem[],
  constructIds: string[],
): NodePos[] {
  // Group items by communityId
  const communities = new Map<number, GeneratedItem[]>()
  for (const item of items) {
    const cid = item.communityId ?? 0
    if (!communities.has(cid)) communities.set(cid, [])
    communities.get(cid)!.push(item)
  }

  const communityIds = Array.from(communities.keys()).sort((a, b) => a - b)
  const numCommunities = communityIds.length
  if (numCommunities === 0) return []

  const outerRadius = Math.min(CX, CY) - 60
  const innerRadius = Math.min(60, outerRadius * 0.4)

  const positions: NodePos[] = []

  communityIds.forEach((cid, ci) => {
    const communityItems = communities.get(cid)!
    // Place community center in a circle
    const angle = (ci / numCommunities) * 2 * Math.PI - Math.PI / 2
    const ccx = CX + outerRadius * Math.cos(angle)
    const ccy = CY + outerRadius * Math.sin(angle)

    communityItems.forEach((item, ii) => {
      const n = communityItems.length
      if (n === 1) {
        positions.push({
          x: ccx,
          y: ccy,
          item,
          constructIndex: constructIds.indexOf(item.constructId),
          communityIndex: ci,
        })
      } else {
        const itemAngle = (ii / n) * 2 * Math.PI
        const r = innerRadius
        positions.push({
          x: ccx + r * Math.cos(itemAngle),
          y: ccy + r * Math.sin(itemAngle),
          item,
          constructIndex: constructIds.indexOf(item.constructId),
          communityIndex: ci,
        })
      }
    })
  })

  return positions
}

interface TooltipState {
  x: number
  y: number
  item: GeneratedItem
}

function NetworkGraph({
  items,
  constructIds,
  onItemClick,
}: {
  items: GeneratedItem[]
  constructIds: string[]
  onItemClick: (itemId: string) => void
}) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const positions = buildRadialLayout(items, constructIds)

  // Build majority communityId per construct for leaking detection
  const constructCommunityMap = React.useMemo(() => {
    const map = new Map<string, number>()
    const constructItemsByConstruct = new Map<string, GeneratedItem[]>()
    items.forEach(item => {
      const arr = constructItemsByConstruct.get(item.constructId) ?? []
      arr.push(item)
      constructItemsByConstruct.set(item.constructId, arr)
    })
    constructItemsByConstruct.forEach((cItems, constructId) => {
      const counts = new Map<number, number>()
      cItems.forEach(i => {
        if (i.communityId != null) {
          counts.set(i.communityId, (counts.get(i.communityId) ?? 0) + 1)
        }
      })
      let maxCount = 0
      let modalCommunityId = -1
      counts.forEach((count, communityId) => {
        if (count > maxCount) { maxCount = count; modalCommunityId = communityId }
      })
      if (modalCommunityId !== -1) map.set(constructId, modalCommunityId)
    })
    return map
  }, [items])

  // Build edges: connect items sharing the same communityId
  // Keep sparse — just draw community centroid spokes, not all pairs
  const communityGroups = new Map<number, NodePos[]>()
  for (const pos of positions) {
    const cid = pos.item.communityId ?? 0
    if (!communityGroups.has(cid)) communityGroups.set(cid, [])
    communityGroups.get(cid)!.push(pos)
  }

  const edges: Array<{ x1: number; y1: number; x2: number; y2: number; communityIndex: number }> = []
  communityGroups.forEach((group, _cid) => {
    if (group.length < 2) return
    // Compute centroid
    const cx = group.reduce((s, p) => s + p.x, 0) / group.length
    const cy = group.reduce((s, p) => s + p.y, 0) / group.length
    group.forEach((pos) => {
      edges.push({ x1: cx, y1: cy, x2: pos.x, y2: pos.y, communityIndex: pos.communityIndex })
    })
  })

  const handleMouseEnter = useCallback(
    (pos: NodePos, e: React.MouseEvent<SVGCircleElement>) => {
      const rect = svgRef.current?.getBoundingClientRect()
      if (!rect) return
      setTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        item: pos.item,
      })
    },
    [],
  )

  const handleMouseLeave = useCallback(() => setTooltip(null), [])

  const handleNodeClick = useCallback(
    (itemId: string) => {
      onItemClick(itemId)
    },
    [onItemClick],
  )

  return (
    <div className="relative rounded-xl bg-card ring-1 ring-foreground/[0.06] shadow-sm overflow-hidden">
      <div className="px-5 pt-4 pb-2">
        <p className="text-overline text-primary">Item Network</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Items grouped by community — coloured by construct assignment
        </p>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="w-full"
        style={{ minHeight: 400 }}
        aria-label="Item network graph"
      >
        {/* Edges */}
        {edges.map((e, i) => (
          <line
            key={i}
            x1={e.x1}
            y1={e.y1}
            x2={e.x2}
            y2={e.y2}
            stroke="currentColor"
            strokeOpacity={0.15}
            strokeWidth={1}
          />
        ))}

        {/* Nodes */}
        {positions.map((pos) => {
          const { item, constructIndex, communityIndex } = pos
          const isProblematic = item.isRedundant || item.isUnstable
          const isLeaking =
            item.communityId != null &&
            constructCommunityMap.has(item.constructId) &&
            item.communityId !== constructCommunityMap.get(item.constructId)

          const r = isProblematic ? 4 : 6
          const fill = item.isRedundant ? "hsl(0 84% 60%)" : constructColor(constructIndex)
          const strokeColor = isLeaking
            ? "hsl(38 92% 50%)"
            : "white"
          const strokeWidth = isLeaking ? 2 : 1
          const strokeDasharray = item.isUnstable ? "2 2" : undefined

          return (
            <circle
              key={item.id}
              cx={pos.x}
              cy={pos.y}
              r={r}
              fill={fill}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              className="cursor-pointer transition-opacity hover:opacity-80"
              onMouseEnter={(e) => handleMouseEnter(pos, e)}
              onMouseLeave={handleMouseLeave}
              onClick={() => handleNodeClick(item.id)}
              aria-label={item.stem.slice(0, 60)}
            />
          )
        })}
      </svg>

      {/* Legend */}
      <div className="px-5 pb-4 flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-primary inline-block" />
          Normal
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-full inline-block" style={{ background: "hsl(0 84% 60%)" }} />
          Redundant
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-full border border-dashed border-foreground/60 inline-block" />
          Unstable
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-full border-2 inline-block" style={{ borderColor: "hsl(38 92% 50%)" }} />
          Leaking
        </span>
      </div>

      {/* SVG Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 max-w-xs rounded-lg bg-popover text-popover-foreground border border-border shadow-md px-3 py-2 text-xs"
          style={{
            left: Math.min(tooltip.x + 12, SVG_W - 200),
            top: Math.max(tooltip.y - 60, 0),
          }}
        >
          <p className="font-medium line-clamp-3">{tooltip.item.stem}</p>
          <div className="mt-1.5 space-y-0.5 text-muted-foreground">
            {tooltip.item.wtoMax !== undefined && (
              <p>
                wTO: {tooltip.item.wtoMax.toFixed(3)}
                {tooltip.item.wtoMax > 0.2 && " ⚠️"}
              </p>
            )}
            {tooltip.item.bootStability !== undefined && (
              <p>
                Stability: {tooltip.item.bootStability.toFixed(3)}
                {tooltip.item.bootStability < 0.75 && " ⚠️"}
              </p>
            )}
            {tooltip.item.communityId !== undefined && (
              <p>Community: {tooltip.item.communityId}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Item row in the review table
// ---------------------------------------------------------------------------

function ItemRow({
  item,
  isSelected,
  onToggleSelect,
  constructIndex,
  onRegisterRef,
}: {
  item: GeneratedItem
  isSelected: boolean
  onToggleSelect: (id: string) => void
  constructIndex: number
  onRegisterRef?: (el: HTMLDivElement | null) => void
}) {
  const [expanded, setExpanded] = useState(false)

  let statusBadge: React.ReactNode
  if (item.isAccepted) {
    statusBadge = <Badge variant="outline">Already Accepted</Badge>
  } else if (item.isRedundant) {
    statusBadge = <Badge variant="destructive">Redundant</Badge>
  } else if (item.isUnstable) {
    statusBadge = <Badge variant="secondary">Unstable</Badge>
  } else {
    statusBadge = <Badge variant="default">Suggested</Badge>
  }

  return (
    <div
      ref={onRegisterRef}
      className={`flex items-start gap-3 px-4 py-3 border-b border-border/50 last:border-0 transition-colors ${
        item.isRedundant || item.isUnstable ? "opacity-60" : ""
      } ${isSelected ? "bg-primary/5" : "hover:bg-muted/30"}`}
    >
      {/* Checkbox */}
      <div className="mt-0.5 shrink-0">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(item.id)}
          disabled={!!item.isAccepted}
          aria-label="Select item"
        />
      </div>

      {/* Stem */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm leading-snug cursor-pointer ${
            expanded ? "" : "line-clamp-2"
          } ${item.isRedundant ? "line-through text-muted-foreground" : ""}`}
          onClick={() => setExpanded((v) => !v)}
        >
          {item.stem}
        </p>
        {item.stem.length > 120 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-primary mt-0.5 flex items-center gap-0.5"
          >
            {expanded ? (
              <>
                <ChevronUp className="size-3" />
                Less
              </>
            ) : (
              <>
                <ChevronDown className="size-3" />
                More
              </>
            )}
          </button>
        )}
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
        {item.reverseScored && (
          <Badge variant="outline" className="text-xs h-5">
            R
          </Badge>
        )}

        {/* Community dot */}
        {item.communityId !== undefined && item.communityId !== null && (
          <span
            className="size-2.5 rounded-full shrink-0 inline-block"
            style={{ background: constructColor(item.communityId - 1) }}
            title={`Community ${item.communityId}`}
          />
        )}

        {/* wTO */}
        {item.wtoMax !== undefined && (
          <span
            className={`text-xs tabular-nums ${
              item.wtoMax > 0.2 ? "text-destructive font-medium" : "text-muted-foreground"
            }`}
            title="Within-community Topological Overlap (wTO)"
          >
            {item.wtoMax > 0.2 && <AlertTriangle className="size-3 inline mr-0.5" />}
            {item.wtoMax.toFixed(3)}
          </span>
        )}

        {/* Stability */}
        {item.bootStability !== undefined && (
          <span
            className={`text-xs tabular-nums ${
              item.bootStability < 0.75 ? "text-amber-500 font-medium" : "text-muted-foreground"
            }`}
            title="Bootstrap EGA stability"
          >
            {item.bootStability < 0.75 && <AlertTriangle className="size-3 inline mr-0.5" />}
            {item.bootStability.toFixed(3)}
          </span>
        )}

        {statusBadge}
      </div>
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
  const itemRefs = useRef<Map<string, HTMLDivElement | null>>(new Map())

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
        // Kick off pipeline via API route so navigation doesn't abort it
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

  // Funnel stats
  const maxCount = run.itemsGenerated || 1
  const afterUva = run.itemsAfterUva ?? run.itemsGenerated
  const afterBoot = run.itemsAfterBoot ?? afterUva
  const suggested = suggestedItems.length

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
        {/* Quality summary panel */}
        <div className="rounded-xl bg-card ring-1 ring-foreground/[0.06] shadow-sm p-5 space-y-5">
          <div>
            <p className="text-overline text-primary mb-3">Quality Funnel</p>
            <div className="space-y-3">
              <FunnelBar
                label="Generated"
                count={run.itemsGenerated}
                maxCount={maxCount}
                colorClass="bg-primary/60"
              />
              <FunnelBar
                label="After UVA"
                count={afterUva}
                maxCount={maxCount}
                colorClass="bg-primary/70"
              />
              <FunnelBar
                label="Stable"
                count={afterBoot}
                maxCount={maxCount}
                colorClass="bg-primary/80"
              />
              <FunnelBar
                label="Suggested"
                count={suggested}
                maxCount={maxCount}
                colorClass="bg-primary"
              />
            </div>
          </div>

          {/* NMI comparison */}
          {run.nmiInitial !== undefined && run.nmiFinal !== undefined && (
            <div>
              <p className="text-overline text-primary mb-3">Network Quality (NMI)</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-caption text-muted-foreground w-16 shrink-0">Initial</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-muted-foreground rounded-full"
                      style={{ width: `${Math.round(run.nmiInitial * 100)}%` }}
                    />
                  </div>
                  <span className="text-caption w-10 text-right tabular-nums">
                    {run.nmiInitial.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-caption text-muted-foreground w-16 shrink-0">
                    Final
                    {run.nmiFinal > run.nmiInitial && (
                      <span className="ml-1 text-primary">▲</span>
                    )}
                  </span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        run.nmiFinal > run.nmiInitial ? "bg-primary" : "bg-muted-foreground"
                      }`}
                      style={{ width: `${Math.round(run.nmiFinal * 100)}%` }}
                    />
                  </div>
                  <span className="text-caption w-10 text-right tabular-nums">
                    {run.nmiFinal.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Run meta */}
          <div className="space-y-2 pt-2 border-t border-border/50">
            {run.modelUsed && (
              <div className="flex justify-between">
                <span className="text-caption text-muted-foreground">Model</span>
                <span className="text-caption font-medium truncate max-w-40">{run.modelUsed}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-caption text-muted-foreground">Constructs</span>
              <span className="text-caption font-medium">{run.config.constructIds.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-caption text-muted-foreground">Target / construct</span>
              <span className="text-caption font-medium">{run.config.targetItemsPerConstruct}</span>
            </div>
          </div>
        </div>

        {/* Network graph */}
        <NetworkGraph
          items={items}
          constructIds={run.config.constructIds}
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

      {/* Item review table grouped by construct */}
      <Accordion multiple defaultValue={run.config.constructIds}>
        {run.config.constructIds.map((constructId, ci) => {
          const constructItems = byConstruct.get(constructId) ?? []
          const passing = constructItems.filter((i) => !i.isRedundant && !i.isUnstable).length
          const passPct =
            constructItems.length > 0
              ? Math.round((passing / constructItems.length) * 100)
              : 0
          const name = constructNameMap.get(constructId) ?? constructId

          return (
            <AccordionItem key={constructId} value={constructId}>
              <AccordionTrigger>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span
                    className="size-2.5 rounded-full shrink-0 inline-block"
                    style={{ background: constructColor(ci) }}
                  />
                  <span className="font-semibold text-sm">{name}</span>
                  <span className="text-caption text-muted-foreground ml-auto mr-4">
                    {constructItems.length} items · {passPct}% passing
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionPanel>
                <div className="divide-y divide-border/30 rounded-b-lg overflow-hidden bg-card">
                  {constructItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-4 py-3">
                      No items generated for this construct.
                    </p>
                  ) : (
                    constructItems.map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        isSelected={selectedIds.has(item.id)}
                        onToggleSelect={handleToggleSelect}
                        constructIndex={ci}
                        onRegisterRef={(el) => {
                          itemRefs.current.set(item.id, el)
                        }}
                      />
                    ))
                  )}
                </div>
              </AccordionPanel>
            </AccordionItem>
          )
        })}
      </Accordion>

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
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const TERMINAL_STATUSES = new Set(["reviewing", "completed", "failed"])

  const fetchData = useCallback(async () => {
    const result = await getGenerationRun(runId)
    if (!result) return

    setRun(result.run)
    setItems(result.items)
    setLoading(false)

    // Stop polling once terminal
    if (TERMINAL_STATUSES.has(result.run.status)) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [runId])

  // Load construct names once
  useEffect(() => {
    getConstructsForGeneration().then((constructs) => {
      const map = new Map<string, string>()
      for (const c of constructs) {
        map.set(c.id, c.name)
      }
      setConstructNameMap(map)
    })
  }, [])

  // Initial fetch + polling
  useEffect(() => {
    fetchData()

    // Start polling — will be stopped inside fetchData once terminal
    pollingRef.current = setInterval(fetchData, 2000)

    return () => {
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
      />

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
