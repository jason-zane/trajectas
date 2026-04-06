"use client"

import { useState, useMemo, useTransition } from "react"
import Link from "next/link"
import {
  Plus,
  Brain,
  Search,
  LayoutGrid,
  Dna,
  FileQuestion,
  ClipboardList,
  ArrowRight,
  X,
} from "lucide-react"
import { toast } from "sonner"
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
import { LibraryBundleImportButton } from "@/components/library-bundle-import-button"
import { LibraryBulkImportButton } from "@/components/library-bulk-import-button"
import { LibraryCardSelectButton } from "@/components/library-card-select-button"
import { LibraryInlineDeleteButton } from "@/components/library-inline-delete-button"
import { LibrarySelectionToolbar } from "@/components/library-selection-toolbar"
import {
  deleteFactor,
  deleteFactors,
  restoreFactor,
  restoreFactors,
  type FactorWithMeta,
} from "@/app/actions/factors"

type StatusFilter = "all" | "active" | "inactive"

export function FactorList({
  factors,
}: {
  factors: FactorWithMeta[]
}) {
  const [searchQuery, setSearchQuery] = useState("")
  const [dimensionFilter, setDimensionFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [ownershipFilter, setOwnershipFilter] = useState("all")
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isDeleting, startDeleteTransition] = useTransition()

  const dimensionNames = useMemo(() => {
    const names = new Set<string>()
    factors.forEach((f) => {
      if (f.dimensionName) names.add(f.dimensionName)
    })
    return Array.from(names).sort()
  }, [factors])

  const orgNames = useMemo(() => {
    const names = new Set<string>()
    factors.forEach((f) => {
      if (f.clientName) names.add(f.clientName)
    })
    return Array.from(names).sort()
  }, [factors])

  const hasFilters =
    searchQuery !== "" ||
    dimensionFilter !== "all" ||
    statusFilter !== "all" ||
    ownershipFilter !== "all"

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
      if (ownershipFilter === "platform-global" && f.clientName) return false
      if (ownershipFilter !== "all" && ownershipFilter !== "platform-global" && f.clientName !== ownershipFilter) return false
      return true
    })
  }, [factors, searchQuery, dimensionFilter, statusFilter, ownershipFilter])

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
  const allVisibleSelected =
    filteredFactors.length > 0 && filteredFactors.every((factor) => selectedIds.includes(factor.id))

  function clearFilters() {
    setSearchQuery("")
    setDimensionFilter("all")
    setStatusFilter("all")
    setOwnershipFilter("all")
  }

  function toggleSelected(id: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? Array.from(new Set([...current, id])) : current.filter((value) => value !== id)
    )
  }

  function toggleAllVisible() {
    setSelectedIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !filteredFactors.some((factor) => factor.id === id))
        : Array.from(new Set([...current, ...filteredFactors.map((factor) => factor.id)]))
    )
  }

  function clearSelection() {
    setSelectedIds([])
  }

  function toggleSelectionMode() {
    setSelectionMode((current) => {
      const next = !current
      if (!next) {
        setSelectedIds([])
      }
      return next
    })
  }

  function handleBulkDelete() {
    const idsToRestore = [...selectedIds]
    startDeleteTransition(async () => {
      const result = await deleteFactors(idsToRestore)
      if (result && "error" in result && result.error) {
        toast.error(result.error)
        return
      }

      setConfirmOpen(false)
      setSelectedIds([])
      toast.success(`Deleted ${result?.count ?? idsToRestore.length} factors`, {
        action: {
          label: "Undo",
          onClick: async () => {
            const restoreResult = await restoreFactors(idsToRestore)
            if (restoreResult && "error" in restoreResult && restoreResult.error) {
              toast.error(restoreResult.error)
              return
            }
            toast.success(`Restored ${restoreResult?.count ?? idsToRestore.length} factors`)
          },
        },
        duration: 5000,
      })
    })
  }

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        eyebrow="Library"
        title="Factor Library"
        description="Manage your psychometric factor definitions. Factors are grouped by dimension and linked to constructs and assessment items."
      >
        <div className="flex items-center gap-2">
          <LibraryBundleImportButton />
          <LibraryBulkImportButton entity="factors" />
          <Link href="/factors/create">
            <Button>
              <Plus className="size-4" />
              Create Factor
            </Button>
          </Link>
        </div>
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
              <Select
                value={ownershipFilter}
                onValueChange={(v) => setOwnershipFilter(v ?? "all")}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All ownership" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All ownership</SelectItem>
                  <SelectItem value="platform-global">Platform-global</SelectItem>
                  {orgNames.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
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
              <LibrarySelectionToolbar
                className="sm:ml-auto"
                selectionMode={selectionMode}
                selectedCount={selectedIds.length}
                visibleCount={filteredFactors.length}
                allVisibleSelected={allVisibleSelected}
                itemLabel="factor"
                itemLabelPlural="factors"
                deleting={isDeleting}
                confirmOpen={confirmOpen}
                onConfirmOpenChange={setConfirmOpen}
                onToggleSelectionMode={toggleSelectionMode}
                onToggleAllVisible={toggleAllVisible}
                onClearSelection={clearSelection}
                onConfirmDelete={handleBulkDelete}
              />
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
                          <TiltCard>
                            <div className="group relative">
                              {selectionMode ? (
                                <div className="absolute top-3 right-3 z-10">
                                  <LibraryCardSelectButton
                                    label={factor.name}
                                    selected={selectedIds.includes(factor.id)}
                                    onToggle={() =>
                                      toggleSelected(factor.id, !selectedIds.includes(factor.id))
                                    }
                                  />
                                </div>
                              ) : null}
                              {!selectionMode ? (
                                <div className="absolute top-3 right-3 z-10 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                                  <LibraryInlineDeleteButton
                                    itemLabel="Factor"
                                    itemName={factor.name}
                                    onDelete={() => deleteFactor(factor.id)}
                                    onRestore={() => restoreFactor(factor.id)}
                                  />
                                </div>
                              ) : null}
                              <Link href={`/factors/${factor.slug}/edit`}>
                                <Card
                                  variant="interactive"
                                  className="flex h-full flex-col"
                                >
                                  <CardHeader className="flex-1">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex items-center gap-2.5">
                                        <div
                                          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-competency-bg transition-shadow duration-300 group-hover/card:shadow-[0_0_20px_var(--glow-color)]"
                                          style={{ "--glow-color": "var(--competency-accent)" } as React.CSSProperties}
                                        >
                                          <Brain className="size-4 text-competency-accent" />
                                        </div>
                                        <CardTitle className="leading-snug">
                                          {factor.name}
                                        </CardTitle>
                                      </div>
                                      <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/card:opacity-100" />
                                    </div>
                                    {factor.description && (
                                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                                        {factor.description}
                                      </p>
                                    )}
                                  </CardHeader>
                                  <CardContent>
                                    <div className="flex flex-wrap items-center gap-3">
                                      {factor.dimensionName && (
                                        <Badge variant="dimension">
                                          {factor.dimensionName}
                                        </Badge>
                                      )}
                                      {factor.clientName && (
                                        <Badge variant="outline">
                                          {factor.clientName}
                                        </Badge>
                                      )}
                                      <Badge variant="dot">
                                        <span
                                          className={`size-1.5 rounded-full ${factor.isActive ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                                        />
                                        {factor.isActive ? "Active" : "Inactive"}
                                      </Badge>
                                    </div>

                                    <div className="mt-3 flex items-center gap-4 border-t border-border/50 pt-3 text-xs text-muted-foreground">
                                      <div className="flex items-center gap-1">
                                        <Dna className="size-3.5" />
                                        <span>
                                          {factor.constructCount}{" "}
                                          {factor.constructCount === 1
                                            ? "construct"
                                            : "constructs"}
                                        </span>
                                        <span className="ml-1 flex items-center gap-0.5">
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
                                      <div className="flex items-center gap-1">
                                        <ClipboardList className="size-3.5" />
                                        <span>
                                          {factor.assessmentCount}{" "}
                                          {factor.assessmentCount === 1
                                            ? "assessment"
                                            : "assessments"}
                                        </span>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              </Link>
                            </div>
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
