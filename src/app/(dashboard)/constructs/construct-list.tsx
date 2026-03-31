"use client"

import { useState, useMemo, useTransition } from "react"
import Link from "next/link"
import {
  Plus,
  Dna,
  Search,
  Brain,
  FileQuestion,
  LayoutGrid,
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
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip"
import {
  deleteConstruct,
  deleteConstructs,
  restoreConstruct,
  restoreConstructs,
  type ConstructWithCounts,
} from "@/app/actions/constructs"

type StatusFilter = "all" | "active" | "inactive"

export function ConstructList({
  constructs,
  alphaMap = {},
}: {
  constructs: ConstructWithCounts[]
  alphaMap?: Record<string, number | null>
}) {
  const hasAlphaData = Object.keys(alphaMap).length > 0
  const [searchQuery, setSearchQuery] = useState("")
  const [dimensionFilter, setDimensionFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isDeleting, startDeleteTransition] = useTransition()

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
  const allVisibleSelected =
    filteredConstructs.length > 0 &&
    filteredConstructs.every((construct) => selectedIds.includes(construct.id))

  function clearFilters() {
    setSearchQuery("")
    setDimensionFilter("all")
    setStatusFilter("all")
  }

  function toggleSelected(id: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? Array.from(new Set([...current, id])) : current.filter((value) => value !== id)
    )
  }

  function toggleAllVisible() {
    setSelectedIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !filteredConstructs.some((construct) => construct.id === id))
        : Array.from(new Set([...current, ...filteredConstructs.map((construct) => construct.id)]))
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
      const result = await deleteConstructs(idsToRestore)
      if (result && "error" in result && result.error) {
        toast.error(result.error)
        return
      }

      setConfirmOpen(false)
      setSelectedIds([])
      toast.success(`Deleted ${result?.count ?? idsToRestore.length} constructs`, {
        action: {
          label: "Undo",
          onClick: async () => {
            const restoreResult = await restoreConstructs(idsToRestore)
            if (restoreResult && "error" in restoreResult && restoreResult.error) {
              toast.error(restoreResult.error)
              return
            }
            toast.success(`Restored ${restoreResult?.count ?? idsToRestore.length} constructs`)
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
        title="Constructs"
        description="Constructs are measurable attributes that sit between factors and items. They provide finer-grained measurement within each factor."
      >
        <div className="flex items-center gap-2">
          <LibraryBundleImportButton />
          <LibraryBulkImportButton entity="constructs" />
          <Link href="/constructs/create">
            <Button>
              <Plus className="size-4" />
              Create Construct
            </Button>
          </Link>
        </div>
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
              <LibrarySelectionToolbar
                className="sm:ml-auto"
                selectionMode={selectionMode}
                selectedCount={selectedIds.length}
                visibleCount={filteredConstructs.length}
                allVisibleSelected={allVisibleSelected}
                itemLabel="construct"
                itemLabelPlural="constructs"
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
                  <AccordionTrigger className="rounded-t-lg border-t-2 border-t-dimension-accent bg-dimension-bg/30">
                    <LayoutGrid className="size-4 text-dimension-accent" />
                    <span className="text-overline text-dimension-fg flex-1">
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
                            <div className="group relative">
                              {selectionMode ? (
                                <div className="absolute top-3 right-3 z-10">
                                  <LibraryCardSelectButton
                                    label={construct.name}
                                    selected={selectedIds.includes(construct.id)}
                                    onToggle={() =>
                                      toggleSelected(
                                        construct.id,
                                        !selectedIds.includes(construct.id)
                                      )
                                    }
                                  />
                                </div>
                              ) : null}
                              {!selectionMode ? (
                                <div className="absolute top-3 right-3 z-10 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                                  <LibraryInlineDeleteButton
                                    itemLabel="Construct"
                                    itemName={construct.name}
                                    onDelete={() => deleteConstruct(construct.id)}
                                    onRestore={() => restoreConstruct(construct.id)}
                                  />
                                </div>
                              ) : null}
                              <Link href={`/constructs/${construct.slug}/edit`}>
                                <Card
                                  variant="interactive"
                                  className="flex h-full flex-col"
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
                                      <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/card:opacity-100" />
                                    </div>
                                    {construct.description && (
                                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                                        {construct.description}
                                      </p>
                                    )}
                                  </CardHeader>
                                  <CardContent>
                                    <div className="flex flex-wrap items-center gap-3">
                                      <Badge variant="dot">
                                        <span
                                          className={`size-1.5 rounded-full ${construct.isActive ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                                        />
                                        {construct.isActive ? "Active" : "Inactive"}
                                      </Badge>
                                      {hasAlphaData && (() => {
                                        const alpha = alphaMap[construct.id]
                                        if (alpha === undefined) return null
                                        const color =
                                          alpha === null
                                            ? "text-muted-foreground bg-muted"
                                            : alpha >= 0.80
                                              ? "text-[var(--success)] bg-[var(--success)]/10"
                                              : alpha >= 0.70
                                                ? "text-[var(--warning)] bg-[var(--warning)]/10"
                                                : "text-[var(--destructive)] bg-[var(--destructive)]/10"
                                        const label = alpha !== null ? `\u03B1 ${alpha.toFixed(2)}` : "\u03B1 \u2014"
                                        const tooltip =
                                          alpha === null
                                            ? "No reliability data"
                                            : alpha >= 0.80
                                              ? "Good internal consistency"
                                              : alpha >= 0.70
                                                ? "Acceptable \u2014 may benefit from refinement"
                                                : "Below threshold \u2014 review items"
                                        return (
                                          <Tooltip>
                                            <TooltipTrigger
                                              render={
                                                <span
                                                  className={`inline-flex h-5 items-center rounded-full px-2 text-[11px] font-semibold tabular-nums cursor-default ${color}`}
                                                />
                                              }
                                            >
                                              {label}
                                            </TooltipTrigger>
                                            <TooltipContent>{tooltip}</TooltipContent>
                                          </Tooltip>
                                        )
                                      })()}
                                    </div>

                                    <div className="mt-3 flex items-center gap-4 border-t border-border/50 pt-3 text-xs text-muted-foreground">
                                      <div className="flex items-center gap-1">
                                        <Brain className="size-3.5" />
                                        <span>
                                          {construct.factorCount}{" "}
                                          {construct.factorCount === 1 ? "factor" : "factors"}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <FileQuestion className="size-3.5" />
                                        <span>
                                          {construct.itemCount}{" "}
                                          {construct.itemCount === 1 ? "item" : "items"}
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
