"use client"

import { useState, useMemo, useTransition } from "react"
import Link from "next/link"
import {
  Plus,
  Dna,
  Search,
  FileQuestion,
  ArrowRight,
  X,
  Shield,
  AlertTriangle,
  Eye,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
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
import type { ItemStatus, ActiveResponseFormatType, ItemPurpose } from "@/types/database"
import {
  deleteItem,
  deleteItems,
  restoreItem,
  restoreItems,
  bulkUpdateItemStatus,
  type ItemWithMeta,
} from "@/app/actions/items"

type ItemHealthInfo = { status: "healthy" | "review" | "action"; discrimination: number | null }

const statusConfig: Record<
  ItemStatus,
  { label: string; dotColor: string }
> = {
  active: { label: "Active", dotColor: "bg-emerald-500" },
  draft: { label: "Draft", dotColor: "bg-amber-500" },
  archived: { label: "Archived", dotColor: "bg-muted-foreground/40" },
}

const formatConfig: Record<ActiveResponseFormatType, { label: string }> = {
  likert: { label: "Likert" },
  forced_choice: { label: "Forced Choice" },
  binary: { label: "Binary" },
  free_text: { label: "Free Text" },
  sjt: { label: "SJT" },
}

const purposeConfig: Record<ItemPurpose, { label: string; icon: typeof Shield; color: string }> = {
  construct: { label: "Construct", icon: Dna, color: "text-trait-accent" },
  impression_management: { label: "Impression Mgmt", icon: Shield, color: "text-amber-600" },
  infrequency: { label: "Infrequency", icon: AlertTriangle, color: "text-orange-600" },
  attention_check: { label: "Attention Check", icon: Eye, color: "text-blue-600" },
}

const allPurposes: { value: ItemPurpose | "all"; label: string }[] = [
  { value: "all", label: "All Items" },
  { value: "construct", label: "Construct" },
  { value: "impression_management", label: "Impression Mgmt" },
  { value: "infrequency", label: "Infrequency" },
  { value: "attention_check", label: "Attention Check" },
]

const allStatuses: { value: ItemStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
]

const allFormats: { value: ActiveResponseFormatType | "all"; label: string }[] = [
  { value: "all", label: "All Formats" },
  { value: "likert", label: "Likert" },
  { value: "forced_choice", label: "Forced Choice" },
  { value: "binary", label: "Binary" },
  { value: "free_text", label: "Free Text" },
  { value: "sjt", label: "SJT" },
]

export function ItemList({ items, healthMap = {} }: { items: ItemWithMeta[]; healthMap?: Record<string, ItemHealthInfo> }) {
  const hasHealthData = Object.keys(healthMap).length > 0
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<ItemStatus | "all">("all")
  const [formatFilter, setFormatFilter] = useState<ActiveResponseFormatType | "all">(
    "all"
  )
  const [constructFilter, setConstructFilter] = useState("all")
  const [purposeFilter, setPurposeFilter] = useState<ItemPurpose | "all">("all")
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isDeleting, startDeleteTransition] = useTransition()

  const constructNames = useMemo(() => {
    const names = new Set<string>()
    items.forEach((i) => {
      if (i.constructName) names.add(i.constructName)
    })
    return Array.from(names).sort()
  }, [items])

  const hasFilters =
    searchQuery !== "" ||
    statusFilter !== "all" ||
    formatFilter !== "all" ||
    constructFilter !== "all" ||
    purposeFilter !== "all"

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matches =
          item.stem.toLowerCase().includes(q) ||
          item.constructName.toLowerCase().includes(q)
        if (!matches) return false
      }
      if (statusFilter !== "all" && item.status !== statusFilter) return false
      if (formatFilter !== "all" && item.responseFormatType !== formatFilter) return false
      if (purposeFilter !== "all" && item.purpose !== purposeFilter) return false
      if (constructFilter !== "all") {
        const name = item.constructName || "Unassigned"
        if (name !== constructFilter) return false
      }
      return true
    })
  }, [items, searchQuery, statusFilter, formatFilter, constructFilter, purposeFilter])

  const grouped = useMemo(() => {
    const acc: Record<string, ItemWithMeta[]> = {}
    for (const item of filteredItems) {
      const isValidity = item.purpose !== "construct"
      const key = isValidity
        ? purposeConfig[item.purpose]?.label ?? item.purpose
        : item.constructName || "Unassigned"
      if (!acc[key]) acc[key] = []
      acc[key].push(item)
    }
    return Object.entries(acc).sort(([a], [b]) => {
      if (a === "Unassigned") return 1
      if (b === "Unassigned") return -1
      return a.localeCompare(b)
    })
  }, [filteredItems])

  const allGroupNames = grouped.map(([name]) => name)
  const allVisibleSelected =
    filteredItems.length > 0 && filteredItems.every((item) => selectedIds.includes(item.id))
  const [expandedGroups, setExpandedGroups] = useState<string[]>([])

  // Keep all groups expanded when the group list changes
  useMemo(() => {
    setExpandedGroups(allGroupNames)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allGroupNames.join(",")])

  function clearFilters() {
    setSearchQuery("")
    setStatusFilter("all")
    setFormatFilter("all")
    setConstructFilter("all")
    setPurposeFilter("all")
  }

  function toggleSelected(id: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? Array.from(new Set([...current, id])) : current.filter((value) => value !== id)
    )
  }

  function toggleAllVisible() {
    setSelectedIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !filteredItems.some((item) => item.id === id))
        : Array.from(new Set([...current, ...filteredItems.map((item) => item.id)]))
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
      const result = await deleteItems(idsToRestore)
      if (result && "error" in result && result.error) {
        toast.error(result.error)
        return
      }

      setConfirmOpen(false)
      setSelectedIds([])
      toast.success(`Deleted ${result?.count ?? idsToRestore.length} items`, {
        action: {
          label: "Undo",
          onClick: async () => {
            const restoreResult = await restoreItems(idsToRestore)
            if (restoreResult && "error" in restoreResult && restoreResult.error) {
              toast.error(restoreResult.error)
              return
            }
            toast.success(`Restored ${restoreResult?.count ?? idsToRestore.length} items`)
          },
        },
        duration: 5000,
      })
    })
  }

  function handleBulkStatusChange(status: string) {
    const ids = [...selectedIds]
    const typedStatus = status as "draft" | "active" | "archived"
    const label = status.charAt(0).toUpperCase() + status.slice(1)
    startDeleteTransition(async () => {
      const result = await bulkUpdateItemStatus(ids, typedStatus)
      if (result && "error" in result && result.error) {
        toast.error(result.error)
        return
      }
      setSelectedIds([])
      toast.success(`Set ${result?.count ?? ids.length} items to ${label.toLowerCase()}`)
    })
  }

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        eyebrow="Library"
        title="Items"
        description="Items are individual questions and stimuli that form the building blocks of your assessments. Each item is linked to a construct."
      >
        <div className="flex items-center gap-2">
          <LibraryBundleImportButton />
          <LibraryBulkImportButton entity="items" />
          <Link href="/items/create">
            <Button>
              <Plus className="size-4" />
              Create Item
            </Button>
          </Link>
        </div>
      </PageHeader>

      {items.length === 0 ? (
        <EmptyState
          variant="item"
          title="No items yet"
          description="Items are the questions presented to participants during assessments. Create your first item to begin building your item pool."
          actionLabel="Create Item"
          actionHref="/items/create"
        />
      ) : (
        <>
          {/* Search + filters */}
          <div className="space-y-3">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search items by stem or construct..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <Select
                value={constructFilter}
                onValueChange={(v) => setConstructFilter(v ?? "all")}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All constructs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All constructs</SelectItem>
                  {constructNames.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                  <SelectItem value="Unassigned">Unassigned</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex rounded-lg bg-muted p-0.5">
                {allStatuses.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setStatusFilter(value)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                      statusFilter === value
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
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
              <LibrarySelectionToolbar
                className="sm:ml-auto"
                selectionMode={selectionMode}
                selectedCount={selectedIds.length}
                visibleCount={filteredItems.length}
                allVisibleSelected={allVisibleSelected}
                itemLabel="item"
                itemLabelPlural="items"
                deleting={isDeleting}
                confirmOpen={confirmOpen}
                onConfirmOpenChange={setConfirmOpen}
                onToggleSelectionMode={toggleSelectionMode}
                onToggleAllVisible={toggleAllVisible}
                onClearSelection={clearSelection}
                onConfirmDelete={handleBulkDelete}
                onSetStatus={handleBulkStatusChange}
              />
            </div>
            {/* Purpose filter pills */}
            <div className="flex gap-2 flex-wrap">
              {allPurposes.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setPurposeFilter(value)}
                  className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    purposeFilter === value
                      ? "bg-item-bg text-item-fg"
                      : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {/* Format filter pills */}
            <div className="flex gap-2 flex-wrap">
              {allFormats.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setFormatFilter(value)}
                  className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    formatFilter === value
                      ? "bg-item-bg text-item-fg"
                      : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {filteredItems.length === 0 ? (
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
            <Accordion multiple value={expandedGroups} onValueChange={setExpandedGroups}>
              {grouped.map(([groupName, groupItems]) => {
                const isValidityGroup = Object.values(purposeConfig).some((p) => p.label === groupName && groupName !== "Construct")
                const purposeEntry = Object.entries(purposeConfig).find(([, v]) => v.label === groupName)
                const GroupIcon = isValidityGroup && purposeEntry ? purposeEntry[1].icon : Dna
                const groupColor = isValidityGroup && purposeEntry ? purposeEntry[1].color : "text-trait-accent"
                const groupBorderColor = isValidityGroup ? "border-t-amber-500 bg-amber-500/5" : "border-t-trait-accent bg-trait-bg/30"

                return (
                <AccordionItem key={groupName} value={groupName}>
                  <AccordionTrigger className={`rounded-t-lg border-t-2 ${groupBorderColor}`}>
                    <GroupIcon className={`size-4 ${groupColor}`} />
                    <span className="text-overline flex-1">
                      {groupName}
                    </span>
                    <span className="text-xs text-muted-foreground font-normal">
                      ({groupItems.length})
                    </span>
                  </AccordionTrigger>
                  <AccordionPanel>
                    <div className="grid gap-3 pt-4 pb-2">
                      {groupItems.map((item, cardIndex) => {
                        const status = statusConfig[item.status]
                        const format =
                          formatConfig[
                            item.responseFormatType as ActiveResponseFormatType
                          ]
                        const isValidity = item.purpose !== "construct"
                        const purposeInfo = purposeConfig[item.purpose]
                        const PurposeIcon = purposeInfo?.icon
                        const health = healthMap[item.id]
                        const healthBorderClass = health
                          ? health.status === "action"
                            ? "border-l-[color:var(--destructive)]"
                            : health.status === "review"
                              ? "border-l-[color:var(--warning)]"
                              : "border-l-[color:var(--success)]"
                          : "border-l-transparent hover:border-l-item-accent"

                        return (
                          <ScrollReveal key={item.id} delay={cardIndex * 60}>
                            <TiltCard>
                              <div className="group relative">
                                {selectionMode ? (
                                  <div className="absolute top-3 right-3 z-10">
                                    <LibraryCardSelectButton
                                      label={item.stem}
                                      selected={selectedIds.includes(item.id)}
                                      onToggle={() =>
                                        toggleSelected(item.id, !selectedIds.includes(item.id))
                                      }
                                    />
                                  </div>
                                ) : null}
                                {!selectionMode ? (
                                  <div className="absolute top-3 right-3 z-10 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                                    <LibraryInlineDeleteButton
                                      itemLabel="Item"
                                      itemName={item.stem}
                                      onDelete={() => deleteItem(item.id)}
                                      onRestore={() => restoreItem(item.id)}
                                    />
                                  </div>
                                ) : null}
                                <Link href={`/items/${item.id}/edit`}>
                                  <Card
                                    variant="interactive"
                                    className={`border-l-[3px] ${hasHealthData ? healthBorderClass : "border-l-transparent hover:border-l-item-accent"}`}
                                  >
                                    <CardContent className="flex items-center gap-4 py-4">
                                      <div
                                        className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-item-bg transition-shadow duration-300 group-hover/card:shadow-[0_0_20px_var(--glow-color)]"
                                        style={{ "--glow-color": "var(--item-accent)" } as React.CSSProperties}
                                      >
                                        <FileQuestion className="size-5 text-item-accent" />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="line-clamp-2 text-sm">
                                          {item.stem}
                                        </p>
                                        <div className="mt-1.5 flex items-center gap-2">
                                          <Badge variant="item">
                                            {format?.label ?? item.responseFormatName}
                                          </Badge>
                                          {isValidity && PurposeIcon && (
                                            <Badge variant="outline" className="gap-1">
                                              <PurposeIcon className="size-3" />
                                              {purposeInfo.label}
                                            </Badge>
                                          )}
                                          <Badge variant="dot">
                                            <span
                                              className={`size-1.5 rounded-full ${status.dotColor}`}
                                            />
                                            {status.label}
                                          </Badge>
                                          {health && (
                                            <Tooltip>
                                              <TooltipTrigger
                                                render={
                                                  <span className="inline-flex cursor-default items-center gap-1" />
                                                }
                                              >
                                                <span
                                                  className={`size-2 rounded-full ${
                                                    health.status === "healthy"
                                                      ? "bg-[var(--success)]"
                                                      : health.status === "review"
                                                        ? "bg-[var(--warning)]"
                                                        : "bg-[var(--destructive)]"
                                                  }`}
                                                />
                                                {health.discrimination !== null && (
                                                  <span className="text-[10px] tabular-nums text-muted-foreground">
                                                    r={health.discrimination.toFixed(2)}
                                                  </span>
                                                )}
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                {health.status === "healthy"
                                                  ? "Item quality: Good"
                                                  : health.status === "review"
                                                    ? "Item quality: Needs review"
                                                    : "Item quality: Action needed"}
                                              </TooltipContent>
                                            </Tooltip>
                                          )}
                                        </div>
                                      </div>
                                      <ArrowRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/card:opacity-100" />
                                    </CardContent>
                                  </Card>
                                </Link>
                              </div>
                            </TiltCard>
                          </ScrollReveal>
                        )
                      })}
                    </div>
                  </AccordionPanel>
                </AccordionItem>
                )
              })}
            </Accordion>
          )}

          <p className="text-caption text-muted-foreground text-center">
            Showing {filteredItems.length} of {items.length} items
          </p>
        </>
      )}
    </div>
  )
}
