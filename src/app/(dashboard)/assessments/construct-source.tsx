"use client"

import { useState, useMemo } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionPanel,
} from "@/components/ui/accordion"
import { DraggableConstructCard } from "./draggable-construct-card"
import type { BuilderConstruct } from "@/app/actions/assessments"

interface ConstructSourceProps {
  constructs: BuilderConstruct[]
  selectedIds: Set<string>
  onToggle: (construct: BuilderConstruct) => void
}

export function ConstructSource({
  constructs,
  selectedIds,
  onToggle,
}: ConstructSourceProps) {
  const [searchQuery, setSearchQuery] = useState("")

  const filtered = useMemo(() => {
    if (!searchQuery) return constructs
    const q = searchQuery.toLowerCase()
    return constructs.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q)) ||
        (c.dimensionName && c.dimensionName.toLowerCase().includes(q)),
    )
  }, [constructs, searchQuery])

  const grouped = useMemo(() => {
    const acc: Record<string, BuilderConstruct[]> = {}
    for (const c of filtered) {
      const key = c.dimensionName || "Ungrouped"
      if (!acc[key]) acc[key] = []
      acc[key].push(c)
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
          Construct Library
        </h3>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search constructs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8"
        />
      </div>

      <Accordion multiple defaultValue={allGroupNames}>
        {grouped.map(([name, groupConstructs]) => (
          <AccordionItem key={name} value={name}>
            <AccordionTrigger>
              {name}
              <span className="text-xs text-muted-foreground ml-auto mr-2">
                {groupConstructs.length}
              </span>
            </AccordionTrigger>
            <AccordionPanel>
              <div className="space-y-1.5">
                {groupConstructs.map((c) => (
                  <DraggableConstructCard
                    key={c.id}
                    construct={c}
                    isAdded={selectedIds.has(c.id)}
                    onToggle={onToggle}
                  />
                ))}
              </div>
            </AccordionPanel>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
