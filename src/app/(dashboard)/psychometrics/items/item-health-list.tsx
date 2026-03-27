"use client"

import { useState, useMemo } from "react"
import { Info, ChevronDown, Search, X } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollReveal } from "@/components/scroll-reveal"
import {
  MetricGauge,
  HorizontalBar,
  HealthBadge,
  type HealthStatus,
} from "@/components/psychometric-visuals"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { ItemHealthRow } from "@/app/actions/psychometrics"

// ---------------------------------------------------------------------------
// Health classification logic
// ---------------------------------------------------------------------------

function classifyHealth(row: ItemHealthRow): HealthStatus {
  if (row.flagged) return "action"

  const d = row.difficulty
  const disc = row.discrimination

  // Hard flags: difficulty outside 0.20–0.80 or discrimination < 0.20
  if (d !== null && (d < 0.2 || d > 0.8)) return "action"
  if (disc !== null && disc < 0.2) return "action"

  // Soft flags: marginal discrimination 0.20–0.29
  if (disc !== null && disc < 0.3) return "review"

  // Marginal difficulty (close to boundaries)
  if (d !== null && (d < 0.25 || d > 0.75)) return "review"

  return "healthy"
}

function difficultyStatus(d: number | null): "good" | "acceptable" | "poor" {
  if (d === null) return "good"
  if (d >= 0.2 && d <= 0.8) {
    if (d >= 0.25 && d <= 0.75) return "good"
    return "acceptable"
  }
  return "poor"
}

function discriminationStatus(
  disc: number | null
): "good" | "acceptable" | "poor" {
  if (disc === null) return "good"
  if (disc >= 0.3) return "good"
  if (disc >= 0.2) return "acceptable"
  return "poor"
}

function difficultyLabel(d: number | null): string {
  if (d === null) return "No data"
  if (d < 0.2) return "Too easy"
  if (d > 0.8) return "Too hard"
  if (d >= 0.4 && d <= 0.6) return "Ideal range"
  if (d >= 0.2 && d <= 0.8) return "Acceptable"
  return "Outside range"
}

function discriminationLabel(disc: number | null): string {
  if (disc === null) return "No data"
  if (disc >= 0.4) return "Excellent"
  if (disc >= 0.3) return "Good"
  if (disc >= 0.2) return "Marginal"
  return "Poor — consider revising"
}

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

type HealthFilter = "all" | "healthy" | "review" | "action"

const healthFilters: { value: HealthFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "action", label: "Action Needed" },
  { value: "review", label: "Needs Review" },
  { value: "healthy", label: "Healthy" },
]

// ---------------------------------------------------------------------------
// ItemHealthCard
// ---------------------------------------------------------------------------

function ItemHealthCard({ row, index }: { row: ItemHealthRow; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const health = classifyHealth(row)

  const borderColor = {
    healthy: "border-l-[color:var(--success)]",
    review: "border-l-[color:var(--warning)]",
    action: "border-l-[color:var(--destructive)]",
  }[health]

  const dStatus = difficultyStatus(row.difficulty)
  const discStatus = discriminationStatus(row.discrimination)

  return (
    <ScrollReveal delay={index * 40}>
      <Card
        variant="interactive"
        className={cn("border-l-[3px]", borderColor)}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Collapsed row — always visible */}
        <CardContent className="py-3">
          <div className="flex items-center gap-3">
            <HealthBadge status={health} className="shrink-0" />

            <p className="flex-1 min-w-0 text-sm line-clamp-1">{row.stem}</p>

            <Badge variant="trait" className="shrink-0 hidden sm:inline-flex">
              {row.constructName}
            </Badge>
            <Badge variant="outline" className="shrink-0 hidden md:inline-flex">
              {row.formatType}
            </Badge>

            {/* Compact metrics */}
            <div className="hidden lg:flex items-center gap-4 shrink-0">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger className="cursor-default">
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        Diff
                      </span>
                      <span
                        className={cn(
                          "text-xs font-semibold tabular-nums",
                          dStatus === "good"
                            ? "text-[var(--success)]"
                            : dStatus === "acceptable"
                              ? "text-[var(--warning)]"
                              : "text-[var(--destructive)]"
                        )}
                      >
                        {row.difficulty !== null
                          ? row.difficulty.toFixed(2)
                          : "—"}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    Difficulty: {difficultyLabel(row.difficulty)}. Ideal range is
                    0.20–0.80.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <div className="w-24">
                <HorizontalBar value={row.discrimination} status={discStatus} />
              </div>
            </div>

            <ChevronDown
              className={cn(
                "size-4 text-muted-foreground shrink-0 transition-transform duration-200",
                expanded && "rotate-180"
              )}
            />
          </div>
        </CardContent>

        {/* Expanded detail panel */}
        {expanded && (
          <CardContent className="pt-0 pb-5 border-t border-border/50">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 pt-4">
              {/* Full stem */}
              <div className="sm:col-span-2 lg:col-span-4">
                <p className="text-sm text-foreground leading-relaxed">
                  {row.stem}
                </p>
                <div className="flex items-center gap-2 mt-2 sm:hidden">
                  <Badge variant="trait">{row.constructName}</Badge>
                  <Badge variant="outline">{row.formatType}</Badge>
                </div>
              </div>

              {/* Difficulty gauge */}
              <div className="flex flex-col items-center gap-2 rounded-xl bg-muted/40 p-4">
                <MetricGauge
                  value={row.difficulty}
                  label="Difficulty"
                  status={dStatus}
                  size={72}
                />
                <span className="text-[11px] text-muted-foreground text-center">
                  {difficultyLabel(row.difficulty)}
                </span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="cursor-default">
                      <Info className="size-3 text-muted-foreground/60" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Proportion of correct/keyed responses. Values between 0.20
                      and 0.80 provide the best measurement precision.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Discrimination bar */}
              <div className="flex flex-col gap-2 rounded-xl bg-muted/40 p-4">
                <HorizontalBar
                  value={row.discrimination}
                  label="Discrimination"
                  status={discStatus}
                />
                <span className="text-[11px] text-muted-foreground">
                  {discriminationLabel(row.discrimination)}
                </span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="cursor-default">
                      <Info className="size-3 text-muted-foreground/60" />
                    </TooltipTrigger>
                    <TooltipContent>
                      How well this item differentiates high from low scorers.
                      Values above 0.30 are good; below 0.20 suggests revision.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Alpha-if-deleted */}
              <div className="flex flex-col gap-1 rounded-xl bg-muted/40 p-4">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Alpha if deleted
                </span>
                <span className="text-xl font-semibold tabular-nums text-foreground">
                  {row.alphaIfDeleted !== null
                    ? row.alphaIfDeleted.toFixed(3)
                    : "—"}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {row.alphaIfDeleted !== null
                    ? "Reliability if this item were removed"
                    : "Not yet computed"}
                </span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="cursor-default">
                      <Info className="size-3 text-muted-foreground/60" />
                    </TooltipTrigger>
                    <TooltipContent>
                      If this value is higher than the current scale alpha,
                      removing this item would improve reliability.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Response count */}
              <div className="flex flex-col gap-1 rounded-xl bg-muted/40 p-4">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Responses
                </span>
                <span className="text-xl font-semibold tabular-nums text-foreground">
                  {row.responseCount !== null
                    ? row.responseCount.toLocaleString()
                    : "—"}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {row.responseCount !== null && row.responseCount < 100
                    ? "Low sample — interpret cautiously"
                    : row.responseCount !== null
                      ? "Sufficient for stable estimates"
                      : "No response data"}
                </span>
              </div>

              {/* Flag reasons */}
              {row.flagReasons.length > 0 && (
                <div className="sm:col-span-2 lg:col-span-4">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Flagged reasons
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {row.flagReasons.map((reason, i) => (
                      <Badge
                        key={i}
                        variant="destructive"
                        className="text-[11px]"
                      >
                        {reason}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>
    </ScrollReveal>
  )
}

// ---------------------------------------------------------------------------
// ItemHealthList — main exported list with filtering
// ---------------------------------------------------------------------------

export function ItemHealthList({ items }: { items: ItemHealthRow[] }) {
  const [searchQuery, setSearchQuery] = useState("")
  const [healthFilter, setHealthFilter] = useState<HealthFilter>("all")

  const enriched = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        health: classifyHealth(item),
      })),
    [items]
  )

  const summary = useMemo(() => {
    let healthy = 0
    let review = 0
    let action = 0
    for (const item of enriched) {
      if (item.health === "healthy") healthy++
      else if (item.health === "review") review++
      else action++
    }
    return { total: enriched.length, healthy, review, action }
  }, [enriched])

  const filtered = useMemo(() => {
    return enriched.filter((item) => {
      if (healthFilter !== "all" && item.health !== healthFilter) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matches =
          item.stem.toLowerCase().includes(q) ||
          item.constructName.toLowerCase().includes(q)
        if (!matches) return false
      }
      return true
    })
  }, [enriched, healthFilter, searchQuery])

  const hasFilters = searchQuery !== "" || healthFilter !== "all"

  function clearFilters() {
    setSearchQuery("")
    setHealthFilter("all")
  }

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-muted/40 ring-1 ring-foreground/[0.06] px-5 py-3">
        <span className="text-sm font-medium text-foreground">
          {summary.total} items analysed
        </span>
        <span className="text-muted-foreground/30">|</span>
        <span className="inline-flex items-center gap-1.5 text-sm">
          <span className="size-2 rounded-full bg-[var(--success)]" />
          <span className="font-medium text-[var(--success)]">
            {summary.healthy}
          </span>
          <span className="text-muted-foreground">healthy</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-sm">
          <span className="size-2 rounded-full bg-[var(--warning)]" />
          <span className="font-medium text-[var(--warning)]">
            {summary.review}
          </span>
          <span className="text-muted-foreground">need review</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-sm">
          <span className="size-2 rounded-full bg-[var(--destructive)]" />
          <span className="font-medium text-[var(--destructive)]">
            {summary.action}
          </span>
          <span className="text-muted-foreground">action needed</span>
        </span>
      </div>

      {/* Search + health filter */}
      <div className="space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by stem or construct..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex rounded-lg bg-muted p-0.5">
            {healthFilters.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setHealthFilter(value)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  healthFilter === value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-muted-foreground"
            >
              <X className="size-3.5" />
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {/* Item cards */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16">
          <p className="text-sm text-muted-foreground">
            No items match your filters.
          </p>
          {hasFilters && (
            <Button
              variant="link"
              size="sm"
              onClick={clearFilters}
              className="mt-2"
            >
              Clear all filters
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((row, index) => (
            <ItemHealthCard key={row.itemId} row={row} index={index} />
          ))}
        </div>
      )}

      <p className="text-caption text-muted-foreground text-center">
        Showing {filtered.length} of {items.length} items
      </p>
    </div>
  )
}
