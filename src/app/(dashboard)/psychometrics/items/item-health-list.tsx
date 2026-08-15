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
import type { ItemWithThresholdRow } from "@/app/actions/psychometrics"

type ItemRow = ItemWithThresholdRow

function classifyHealth(row: ItemRow): HealthStatus {
  if (row.flagged) return "action"

  const d = row.difficulty
  const disc = row.discrimination

  if (d !== null && (d < 0.2 || d > 0.8)) return "action"
  if (disc !== null && disc < 0.2) return "action"

  if (disc !== null && disc < 0.3) return "review"

  if (d !== null && (d < 0.25 || d > 0.75)) return "review"

  return "healthy"
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

type HealthFilter = "all" | "healthy" | "review" | "action"

const healthFilters: { value: HealthFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "action", label: "Action Needed" },
  { value: "review", label: "Needs Review" },
  { value: "healthy", label: "Healthy" },
]

function ItemHealthCard({ row, index }: { row: ItemRow; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const health = classifyHealth(row)

  const borderColor = {
    healthy: "border-l-[color:var(--success)]",
    review: "border-l-[color:var(--warning)]",
    action: "border-l-[color:var(--destructive)]",
  }[health]

  return (
    <ScrollReveal delay={index * 40}>
      <Card
        className={cn("border-l-4 border-l-muted/40 transition-all", borderColor, {
          "bg-muted/30": expanded,
        })}
      >
        <CardContent className="p-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full text-left"
          >
            <div className="flex items-start justify-between p-4 gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-snug line-clamp-2 text-foreground">
                  {row.stem}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <Badge variant="secondary" className="text-[11px]">
                    {row.constructName}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[11px] text-muted-foreground"
                  >
                    {row.formatType}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center gap-4 flex-shrink-0">
                <HealthBadge status={health} />
                <ChevronDown
                  className={cn("size-4 text-muted-foreground transition-transform", {
                    "rotate-180": expanded,
                  })}
                />
              </div>
            </div>
          </button>

          {expanded && (
            <div className="border-t border-border bg-muted/20">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
                {row.withheldReason ? (
                  <div className="col-span-full flex items-start gap-2 rounded-md bg-muted/50 p-3">
                    <Info className="size-4 mt-0.5 shrink-0 text-muted-foreground" />
                    <div className="text-xs text-muted-foreground">
                      {row.withheldReason}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col gap-1 rounded-xl bg-muted/40 p-4">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                        Difficulty
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-semibold tabular-nums text-foreground">
                          {row.difficulty !== null
                            ? (row.difficulty * 100).toFixed(0)
                            : "—"}
                          %
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        <MetricGauge
                          value={
                            row.difficulty !== null
                              ? row.difficulty * 100
                              : 0
                          }
                          size={32}
                        />
                        <span className="text-muted-foreground">
                          {difficultyLabel(row.difficulty)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 rounded-xl bg-muted/40 p-4">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                        Discrimination
                      </span>
                      <span className="text-xl font-semibold tabular-nums text-foreground">
                        {row.discrimination !== null
                          ? row.discrimination.toFixed(2)
                          : "—"}
                      </span>
                      <div className="flex items-center gap-1 text-xs">
                        <MetricGauge
                          value={
                            row.discrimination !== null
                              ? row.discrimination * 100
                              : 0
                          }
                          size={32}
                        />
                        <span className="text-muted-foreground">
                          {discriminationLabel(row.discrimination)}
                        </span>
                      </div>
                    </div>

                    {row.alphaIfDeleted !== null && (
                      <div className="flex flex-col gap-1 rounded-xl bg-muted/40 p-4">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                          α if deleted
                        </span>
                        <span className="text-xl font-semibold tabular-nums text-foreground">
                          {row.alphaIfDeleted.toFixed(2)}
                        </span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger className="text-[11px] text-muted-foreground text-left">
                              Impact on scale
                            </TooltipTrigger>
                            <TooltipContent>
                              If this value is higher than the current scale alpha,
                              removing this item would improve reliability.
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    )}

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

                    {row.flagReasons.length > 0 && (
                      <div className="col-span-full">
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

                    {row.hasOptions &&
                      row.responseDistribution &&
                      Object.keys(row.responseDistribution).length > 0 && (
                        <div className="col-span-full">
                          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-3 block">
                            Response Distribution
                          </span>
                          <div className="space-y-2">
                            {Object.entries(row.responseDistribution)
                              .sort((a, b) => Number(a[0]) - Number(b[0]))
                              .map(([value, count]) => {
                                const totalResponses = Object.values(
                                  row.responseDistribution
                                ).reduce((a, b) => Number(a) + Number(b), 0)
                                const percentage =
                                  totalResponses > 0
                                    ? ((Number(count) / totalResponses) * 100).toFixed(1)
                                    : "0"

                                return (
                                  <div
                                    key={value}
                                    className="flex items-center gap-3"
                                  >
                                    <span className="text-xs text-muted-foreground w-12">
                                      {value}
                                    </span>
                                    <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                                      <div
                                        className="bg-trait-accent h-full"
                                        style={{
                                          width: `${percentage}%`,
                                        }}
                                      />
                                    </div>
                                    <div className="flex gap-1 items-center">
                                      <span className="text-xs font-medium tabular-nums w-8 text-right">
                                        {count}
                                      </span>
                                      <span className="text-xs text-muted-foreground w-12 text-right">
                                        {percentage}%
                                      </span>
                                    </div>
                                  </div>
                                )
                              })}
                          </div>
                        </div>
                      )}
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </ScrollReveal>
  )
}

export function ItemHealthList({ items }: { items: ItemRow[] }) {
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
