"use client"

import { useState, useMemo } from "react"
import { Search, LayoutGrid, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionPanel,
} from "@/components/ui/accordion"
import { DraggableFactorCard } from "./draggable-factor-card"
import type { BuilderFactor } from "@/app/actions/assessments"

interface FactorSourceProps {
  factors: BuilderFactor[]
  selectedIds: Set<string>
  onToggle: (factor: BuilderFactor) => void
}

export function FactorSource({
  factors,
  selectedIds,
  onToggle,
}: FactorSourceProps) {
  const [searchQuery, setSearchQuery] = useState("")

  const filtered = useMemo(() => {
    if (!searchQuery) return factors
    const q = searchQuery.toLowerCase()
    return factors.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.description && f.description.toLowerCase().includes(q)) ||
        (f.dimensionName && f.dimensionName.toLowerCase().includes(q))
    )
  }, [factors, searchQuery])

  const grouped = useMemo(() => {
    const acc: Record<string, BuilderFactor[]> = {}
    for (const factor of filtered) {
      const key = factor.dimensionName || "Ungrouped"
      if (!acc[key]) acc[key] = []
      acc[key].push(factor)
    }
    return Object.entries(acc).sort(([a], [b]) => {
      if (a === "Ungrouped") return 1
      if (b === "Ungrouped") return -1
      return a.localeCompare(b)
    })
  }, [filtered])

  const allGroupNames = grouped.map(([name]) => name)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Factor Library
        </h3>
        <span className="text-xs text-muted-foreground">
          {factors.length} available
        </span>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search factors..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-8">
          <p className="text-sm text-muted-foreground">
            No factors match your search.
          </p>
        </div>
      ) : (
        <div className="max-h-[calc(100vh-380px)] overflow-y-auto rounded-lg">
          <Accordion multiple defaultValue={allGroupNames}>
            {grouped.map(([groupName, groupFactors]) => (
              <AccordionItem key={groupName} value={groupName}>
                <AccordionTrigger className="rounded-t-lg border-t-2 border-t-dimension-accent bg-dimension-bg/30 py-2">
                  <LayoutGrid className="size-3.5 text-dimension-accent" />
                  <span className="text-overline text-dimension-fg flex-1 text-xs">
                    {groupName}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    ({groupFactors.length})
                  </span>
                </AccordionTrigger>
                <AccordionPanel>
                  <div className="space-y-1.5 py-2">
                    {groupFactors.map((factor) => (
                      <DraggableFactorCard
                        key={factor.id}
                        factor={factor}
                        isAdded={selectedIds.has(factor.id)}
                        onToggle={onToggle}
                      />
                    ))}
                  </div>
                </AccordionPanel>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}
    </div>
  )
}
