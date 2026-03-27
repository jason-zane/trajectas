"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import {
  Plus,
  Brain,
  Search,
  LayoutGrid,
  Dna,
  FileQuestion,
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
import type { FactorWithMeta } from "@/app/actions/factors"

type StatusFilter = "all" | "active" | "inactive"

export function FactorList({
  factors,
}: {
  factors: FactorWithMeta[]
}) {
  const [searchQuery, setSearchQuery] = useState("")
  const [dimensionFilter, setDimensionFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

  const dimensionNames = useMemo(() => {
    const names = new Set<string>()
    factors.forEach((f) => {
      if (f.dimensionName) names.add(f.dimensionName)
    })
    return Array.from(names).sort()
  }, [factors])

  const hasFilters =
    searchQuery !== "" ||
    dimensionFilter !== "all" ||
    statusFilter !== "all"

  const filteredFactors = useMemo(() => {
    return factors.filter((f) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matches =
          f.name.toLowerCase().includes(q) ||
          (f.description && f.description.toLowerCase().includes(q)) ||
          (f.dimensionName && f.dimensionName.toLowerCase().includes(q))
        if (!matches) return false
      }
      if (dimensionFilter !== "all") {
        const dimName = f.dimensionName || "Ungrouped"
        if (dimName !== dimensionFilter) return false
      }
      if (statusFilter === "active" && !f.isActive) return false
      if (statusFilter === "inactive" && f.isActive) return false
      return true
    })
  }, [factors, searchQuery, dimensionFilter, statusFilter])

  const grouped = useMemo(() => {
    const acc: Record<string, FactorWithMeta[]> = {}
    for (const factor of filteredFactors) {
      const key = factor.dimensionName || "Ungrouped"
      if (!acc[key]) acc[key] = []
      acc[key].push(factor)
    }
    return Object.entries(acc).sort(([a], [b]) => {
      if (a === "Ungrouped") return 1
      if (b === "Ungrouped") return -1
      return a.localeCompare(b)
    })
  }, [filteredFactors])

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
        title="Factor Library"
        description="Manage your psychometric factor definitions. Factors are grouped by dimension and linked to constructs and assessment items."
      >
        <Link href="/factors/create">
          <Button>
            <Plus className="size-4" />
            Create Factor
          </Button>
        </Link>
      </PageHeader>

      {factors.length === 0 ? (
        <EmptyState
          variant="competency"
          title="No factors yet"
          description="Factors define the behavioural capabilities you want to measure. Create your first factor to begin building your library."
          actionLabel="Create Factor"
          actionHref="/factors/create"
        />
      ) : (
        <>
          {/* Search + filters */}
          <div className="space-y-3">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search factors..."
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
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as StatusFilter)}
              >
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="All status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
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

          {filteredFactors.length === 0 ? (
            <div className="flex flex-col items-center py-16">
              <p className="text-sm text-muted-foreground">
                No factors match your filters.
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
              {grouped.map(([groupName, groupFactors]) => (
                <AccordionItem key={groupName} value={groupName}>
                  <AccordionTrigger className="rounded-t-lg border-t-2 border-t-dimension-accent bg-dimension-bg/30">
                    <LayoutGrid className="size-4 text-dimension-accent" />
                    <span className="text-overline text-dimension-fg flex-1">
                      {groupName}
                    </span>
                    <span className="text-xs text-muted-foreground font-normal">
                      ({groupFactors.length})
                    </span>
                  </AccordionTrigger>
                  <AccordionPanel>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-4 pb-2">
                      {groupFactors.map((factor, cardIndex) => (
                        <ScrollReveal key={factor.id} delay={cardIndex * 60}>
                          <Link href={`/factors/${factor.slug}/edit`}>
                            <Card
                              variant="interactive"
                              className="flex flex-col h-full"
                            >
                              <CardHeader className="flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2.5">
                                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-competency-bg">
                                      <Brain className="size-4 text-competency-accent" />
                                    </div>
                                    <CardTitle className="leading-snug">
                                      {factor.name}
                                    </CardTitle>
                                  </div>
                                  <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover/card:opacity-100 transition-opacity shrink-0 mt-0.5" />
                                </div>
                                {factor.description && (
                                  <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                                    {factor.description}
                                  </p>
                                )}
                              </CardHeader>
                              <CardContent>
                                <div className="flex items-center gap-3 flex-wrap">
                                  {factor.dimensionName && (
                                    <Badge variant="dimension">
                                      {factor.dimensionName}
                                    </Badge>
                                  )}
                                  <Badge variant="dot">
                                    <span
                                      className={`size-1.5 rounded-full ${factor.isActive ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                                    />
                                    {factor.isActive ? "Active" : "Inactive"}
                                  </Badge>
                                </div>

                                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-3 pt-3 border-t border-border/50">
                                  <div className="flex items-center gap-1">
                                    <Dna className="size-3.5" />
                                    <span>
                                      {factor.constructCount}{" "}
                                      {factor.constructCount === 1
                                        ? "construct"
                                        : "constructs"}
                                    </span>
                                    <span className="flex items-center gap-0.5 ml-1">
                                      {Array.from({
                                        length: Math.min(factor.constructCount, 5),
                                      }).map((_, i) => (
                                        <span
                                          key={i}
                                          className="size-1.5 rounded-full bg-trait-accent"
                                        />
                                      ))}
                                      {Array.from({
                                        length: Math.max(
                                          5 - factor.constructCount,
                                          0
                                        ),
                                      }).map((_, i) => (
                                        <span
                                          key={`empty-${i}`}
                                          className="size-1.5 rounded-full bg-border"
                                        />
                                      ))}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <FileQuestion className="size-3.5" />
                                    <span>
                                      {factor.itemCount}{" "}
                                      {factor.itemCount === 1 ? "item" : "items"}
                                    </span>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </Link>
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
