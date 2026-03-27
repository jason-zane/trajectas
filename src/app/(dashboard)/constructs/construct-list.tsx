"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import {
  Plus,
  Dna,
  Search,
  Brain,
  ArrowRight,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionPanel,
} from "@/components/ui/accordion"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { ScrollReveal } from "@/components/scroll-reveal"
import { TiltCard } from "@/components/tilt-card"
import type { ConstructWithCounts } from "@/app/actions/constructs"

type StatusFilter = "all" | "active" | "inactive"

export function ConstructList({
  constructs,
}: {
  constructs: ConstructWithCounts[]
}) {
  const [searchQuery, setSearchQuery] = useState("")
  const [dimensionFilter, setDimensionFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

  const dimensionNames = useMemo(() => {
    const names = new Set<string>()
    constructs.forEach((c) => {
      c.dimensionNames.forEach((dn) => names.add(dn))
    })
    return Array.from(names).sort()
  }, [constructs])

  const hasFilters =
    searchQuery !== "" ||
    dimensionFilter !== "all" ||
    statusFilter !== "all"

  const filteredConstructs = useMemo(() => {
    return constructs.filter((c) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matches =
          c.name.toLowerCase().includes(q) ||
          (c.description && c.description.toLowerCase().includes(q))
        if (!matches) return false
      }
      if (dimensionFilter !== "all") {
        if (dimensionFilter === "Ungrouped") {
          if (c.dimensionNames.length > 0) return false
        } else {
          if (!c.dimensionNames.includes(dimensionFilter)) return false
        }
      }
      if (statusFilter === "active" && !c.isActive) return false
      if (statusFilter === "inactive" && c.isActive) return false
      return true
    })
  }, [constructs, searchQuery, dimensionFilter, statusFilter])

  // Group constructs by dimension — a construct can appear under multiple dimensions
  const grouped = useMemo(() => {
    const acc: Record<string, ConstructWithCounts[]> = {}
    for (const construct of filteredConstructs) {
      if (construct.dimensionNames.length === 0) {
        if (!acc["Ungrouped"]) acc["Ungrouped"] = []
        acc["Ungrouped"].push(construct)
      } else {
        for (const dimName of construct.dimensionNames) {
          if (!acc[dimName]) acc[dimName] = []
          acc[dimName].push(construct)
        }
      }
    }
    return Object.entries(acc).sort(([a], [b]) => {
      if (a === "Ungrouped") return 1
      if (b === "Ungrouped") return -1
      return a.localeCompare(b)
    })
  }, [filteredConstructs])

  const allGroupNames = grouped.map(([name]) => name)

  function clearFilters() {
    setSearchQuery("")
    setDimensionFilter("all")
    setStatusFilter("all")
  }

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        eyebrow="Library"
        title="Constructs"
        description="Constructs are measurable attributes that sit between factors and items. They provide finer-grained measurement within each factor."
      >
        <Link href="/constructs/create">
          <Button>
            <Plus className="size-4" />
            Create Construct
          </Button>
        </Link>
      </PageHeader>

      {constructs.length === 0 ? (
        <EmptyState
          variant="trait"
          title="No constructs yet"
          description="Constructs add a layer of granularity between factors and items. Create your first construct to start building your measurement model."
          actionLabel="Create Construct"
          actionHref="/constructs/create"
        />
      ) : (
        <>
          {/* Search + filters */}
          <div className="space-y-3">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search constructs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <Select
                value={dimensionFilter}
                onValueChange={(v) => setDimensionFilter(v ?? "all")}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All dimensions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All dimensions</SelectItem>
                  {dimensionNames.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                  <SelectItem value="Ungrouped">Ungrouped</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex rounded-lg bg-muted p-0.5">
                {(["all", "active", "inactive"] as const).map((value) => (
                  <button
                    key={value}
                    onClick={() => setStatusFilter(value)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                      statusFilter === value
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {value === "all" ? "All" : value === "active" ? "Active" : "Inactive"}
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

          {filteredConstructs.length === 0 ? (
            <div className="flex flex-col items-center py-16">
              <p className="text-sm text-muted-foreground">
                No constructs match your filters.
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
            <Accordion multiple defaultValue={allGroupNames}>
              {grouped.map(([groupName, groupConstructs]) => (
                <AccordionItem key={groupName} value={groupName}>
                  <AccordionTrigger className="rounded-t-lg border-t-2 border-t-trait-accent bg-trait-bg/30">
                    <Dna className="size-4 text-trait-accent" />
                    <span className="text-overline text-trait-fg flex-1">
                      {groupName}
                    </span>
                    <span className="text-xs text-muted-foreground font-normal">
                      ({groupConstructs.length})
                    </span>
                  </AccordionTrigger>
                  <AccordionPanel>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-4 pb-2">
                      {groupConstructs.map((construct, cardIndex) => (
                        <ScrollReveal key={construct.id} delay={cardIndex * 60}>
                          <TiltCard>
                          <Link href={`/constructs/${construct.slug}/edit`}>
                            <Card
                              variant="interactive"
                              className="flex flex-col h-full"
                            >
                              <CardHeader className="flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2.5">
                                    <div
                                      className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-trait-bg transition-shadow duration-300 group-hover/card:shadow-[0_0_20px_var(--glow-color)]"
                                      style={{ "--glow-color": "var(--trait-accent)" } as React.CSSProperties}
                                    >
                                      <Dna className="size-4 text-trait-accent" />
                                    </div>
                                    <CardTitle className="leading-snug">
                                      {construct.name}
                                    </CardTitle>
                                  </div>
                                  <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover/card:opacity-100 transition-opacity shrink-0 mt-0.5" />
                                </div>
                                {construct.description && (
                                  <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                                    {construct.description}
                                  </p>
                                )}
                              </CardHeader>
                              <CardContent>
                                <div className="flex items-center gap-3 flex-wrap">
                                  <Badge variant="dot">
                                    <span
                                      className={`size-1.5 rounded-full ${construct.isActive ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                                    />
                                    {construct.isActive ? "Active" : "Inactive"}
                                  </Badge>
                                </div>

                                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-3 pt-3 border-t border-border/50">
                                  <div className="flex items-center gap-1">
                                    <Brain className="size-3.5" />
                                    <span>
                                      {construct.factorCount}{" "}
                                      {construct.factorCount === 1 ? "factor" : "factors"}
                                    </span>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </Link>
                          </TiltCard>
                        </ScrollReveal>
                      ))}
                    </div>
                  </AccordionPanel>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </>
      )}
    </div>
  )
}
