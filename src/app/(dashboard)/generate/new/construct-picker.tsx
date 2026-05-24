"use client"

import React, { useMemo, useState } from "react"
import {
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Search,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface PickerConstruct {
  id: string
  name: string
  dimensionName?: string | null
  definition?: string | null
  existingItemCount: number
}

type ItemFilter = "all" | "has-items" | "no-items"

const ITEM_FILTERS: ReadonlyArray<{
  id: ItemFilter
  label: string
  hint: string
}> = [
  { id: "all", label: "All", hint: "Show every construct" },
  { id: "has-items", label: "Has items", hint: "Constructs with existing items" },
  { id: "no-items", label: "No items", hint: "Constructs with zero items" },
]

export function ConstructPicker({
  constructs,
  selectedIds,
  onToggle,
  onBulkSet,
  onNext,
}: {
  constructs: PickerConstruct[] | null
  selectedIds: string[]
  onToggle: (id: string) => void
  /** Replace the entire selection (used by "select all visible" and "clear"). */
  onBulkSet: (ids: string[]) => void
  onNext: () => void
}) {
  const [search, setSearch] = useState("")
  const [itemFilter, setItemFilter] = useState<ItemFilter>("all")
  const [collapsedDimensions, setCollapsedDimensions] = useState<Set<string>>(
    new Set(),
  )

  const isLoading = constructs === null

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  // Apply search + item filter
  const filtered = useMemo(() => {
    if (!constructs) return []
    const needle = search.trim().toLowerCase()
    return constructs.filter((c) => {
      if (itemFilter === "has-items" && c.existingItemCount === 0) return false
      if (itemFilter === "no-items" && c.existingItemCount > 0) return false
      if (!needle) return true
      const haystack =
        c.name.toLowerCase() +
        " " +
        (c.definition?.toLowerCase() ?? "") +
        " " +
        (c.dimensionName?.toLowerCase() ?? "")
      return haystack.includes(needle)
    })
  }, [constructs, search, itemFilter])

  // Group by dimension, preserving original order
  const grouped = useMemo(() => {
    const map = new Map<string, PickerConstruct[]>()
    for (const c of filtered) {
      const key = c.dimensionName ?? "Other"
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(c)
    }
    return map
  }, [filtered])

  const totalCount = constructs?.length ?? 0
  const visibleCount = filtered.length
  const selectedCount = selectedIds.length

  const visibleIds = useMemo(() => filtered.map((c) => c.id), [filtered])
  const allVisibleSelected =
    visibleCount > 0 && visibleIds.every((id) => selectedSet.has(id))

  function handleSelectAllVisible() {
    // Union of current selection and all visible.
    const next = new Set(selectedIds)
    for (const id of visibleIds) next.add(id)
    onBulkSet(Array.from(next))
  }

  function handleClearVisible() {
    // Remove visible from selection; keep selections that aren't currently visible.
    const visible = new Set(visibleIds)
    onBulkSet(selectedIds.filter((id) => !visible.has(id)))
  }

  function handleClearAll() {
    onBulkSet([])
  }

  function toggleDimensionCollapsed(dimension: string) {
    setCollapsedDimensions((prev) => {
      const next = new Set(prev)
      if (next.has(dimension)) next.delete(dimension)
      else next.add(dimension)
      return next
    })
  }

  function selectAllInDimension(items: PickerConstruct[]) {
    const next = new Set(selectedIds)
    for (const c of items) next.add(c.id)
    onBulkSet(Array.from(next))
  }

  function clearAllInDimension(items: PickerConstruct[]) {
    const ids = new Set(items.map((c) => c.id))
    onBulkSet(selectedIds.filter((id) => !ids.has(id)))
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Select constructs</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Pick the constructs you want to generate items for. Search by name or
          definition; filter by whether the construct already has items.
        </p>
      </div>

      {/* Toolbar — sticky so the counter is always visible */}
      <Card className="sticky top-0 z-10">
        <CardContent className="p-3 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search constructs by name or definition…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-9"
                aria-label="Search constructs"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <div className="flex gap-1.5">
              {ITEM_FILTERS.map((f) => {
                const active = itemFilter === f.id
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setItemFilter(f.id)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                      active
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "border-border bg-card text-foreground hover:bg-cream/60",
                    )}
                    title={f.hint}
                    style={{
                      transitionTimingFunction: "var(--ease-spring)",
                      transitionDuration: "200ms",
                    }}
                  >
                    {f.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="text-muted-foreground tabular-nums">
              <span className="font-semibold text-foreground">{selectedCount}</span>{" "}
              selected · {visibleCount} of {totalCount} constructs visible
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSelectAllVisible}
                disabled={visibleCount === 0 || allVisibleSelected}
                className="h-7 px-2 text-xs"
              >
                <Check className="size-3" /> Select all visible
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearVisible}
                disabled={visibleCount === 0}
                className="h-7 px-2 text-xs"
              >
                Clear visible
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                disabled={selectedCount === 0}
                className="h-7 px-2 text-xs"
              >
                Clear all
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scrollable construct list */}
      <div className="max-h-[560px] overflow-y-auto pr-1 space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
            <Loader2 className="size-4 animate-spin" />
            Loading constructs…
          </div>
        ) : totalCount === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No active constructs found. Create and activate constructs in the
                Library first.
              </p>
            </CardContent>
          </Card>
        ) : visibleCount === 0 ? (
          <Card>
            <CardContent className="p-8 text-center space-y-2">
              <p className="text-sm font-medium">No constructs match</p>
              <p className="text-xs text-muted-foreground">
                Try a different search, or switch the filter.
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("")
                  setItemFilter("all")
                }}
              >
                Reset filters
              </Button>
            </CardContent>
          </Card>
        ) : (
          Array.from(grouped.entries()).map(([dimension, items]) => {
            const collapsed = collapsedDimensions.has(dimension)
            const selectedInGroup = items.filter((c) =>
              selectedSet.has(c.id),
            ).length
            const allInGroupSelected =
              items.length > 0 && selectedInGroup === items.length
            return (
              <div key={dimension} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => toggleDimensionCollapsed(dimension)}
                    className="inline-flex items-center gap-1.5 text-overline text-gold hover:opacity-80"
                  >
                    {collapsed ? (
                      <ChevronRight className="size-3" />
                    ) : (
                      <ChevronDown className="size-3" />
                    )}
                    {dimension}
                    <span className="text-muted-foreground/70 font-mono normal-case tracking-normal ml-1">
                      ({selectedInGroup}/{items.length})
                    </span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      allInGroupSelected
                        ? clearAllInDimension(items)
                        : selectAllInDimension(items)
                    }
                    className="h-6 px-2 text-[10px] uppercase tracking-wider font-mono"
                  >
                    {allInGroupSelected ? "Clear group" : "Select group"}
                  </Button>
                </div>
                {!collapsed && (
                  <div className="grid gap-2">
                    {items.map((construct) => (
                      <ConstructRow
                        key={construct.id}
                        construct={construct}
                        isSelected={selectedSet.has(construct.id)}
                        onToggle={() => onToggle(construct.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <div className="flex items-center justify-between pt-2">
        <span className="text-sm text-muted-foreground">
          {selectedCount === 0
            ? "No constructs selected"
            : `${selectedCount} construct${selectedCount !== 1 ? "s" : ""} selected`}
        </span>
        <Button onClick={onNext} disabled={selectedCount === 0}>
          Next: Check readiness
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}

function ConstructRow({
  construct,
  isSelected,
  onToggle,
}: {
  construct: PickerConstruct
  isSelected: boolean
  onToggle: () => void
}) {
  return (
    <label
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all",
        isSelected
          ? "border-primary/50 bg-primary/5"
          : "border-border hover:border-primary/30 hover:bg-cream/40",
      )}
      style={{
        transitionTimingFunction: "var(--ease-spring)",
        transitionDuration: "200ms",
      }}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={onToggle}
        className="mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold">{construct.name}</span>
          <Badge
            variant={construct.existingItemCount > 0 ? "outline" : "secondary"}
            className="text-[10px]"
          >
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
  )
}
