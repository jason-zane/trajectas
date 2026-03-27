"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import {
  Plus,
  Dna,
  Search,
  FileQuestion,
  ArrowRight,
  X,
} from "lucide-react"
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
import type { ItemStatus, ActiveResponseFormatType } from "@/types/database"
import type { ItemWithMeta } from "@/app/actions/items"

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

export function ItemList({ items }: { items: ItemWithMeta[] }) {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<ItemStatus | "all">("all")
  const [formatFilter, setFormatFilter] = useState<ActiveResponseFormatType | "all">(
    "all"
  )
  const [constructFilter, setConstructFilter] = useState("all")

  const constructNames = useMemo(() => {
    const names = new Set<string>()
    items.forEach((i) => {
      if (i.constructName) names.add(i.constructName)
    })
    return Array.from(names).sort()
  }, [items])

  const constructSlugMap = useMemo(() => {
    const map: Record<string, string> = {}
    items.forEach((i) => {
      if (i.constructName && i.constructSlug) map[i.constructName] = i.constructSlug
    })
    return map
  }, [items])

  const hasFilters =
    searchQuery !== "" ||
    statusFilter !== "all" ||
    formatFilter !== "all" ||
    constructFilter !== "all"

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
      if (constructFilter !== "all") {
        const name = item.constructName || "Unassigned"
        if (name !== constructFilter) return false
      }
      return true
    })
  }, [items, searchQuery, statusFilter, formatFilter, constructFilter])

  const grouped = useMemo(() => {
    const acc: Record<string, ItemWithMeta[]> = {}
    for (const item of filteredItems) {
      const key = item.constructName || "Unassigned"
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

  function clearFilters() {
    setSearchQuery("")
    setStatusFilter("all")
    setFormatFilter("all")
    setConstructFilter("all")
  }

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        eyebrow="Library"
        title="Items"
        description="Items are individual questions and stimuli that form the building blocks of your assessments. Each item is linked to a construct."
      >
        <Link href="/items/create">
          <Button>
            <Plus className="size-4" />
            Create Item
          </Button>
        </Link>
      </PageHeader>

      {items.length === 0 ? (
        <EmptyState
          variant="item"
          title="No items yet"
          description="Items are the questions presented to candidates during assessments. Create your first item to begin building your item pool."
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
                      : "bg-transparent text-muted-foreground hover:text-foreground border border-border"
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
            <Accordion multiple defaultValue={allGroupNames}>
              {grouped.map(([groupName, groupItems]) => (
                <AccordionItem key={groupName} value={groupName}>
                  <AccordionTrigger className="rounded-t-lg border-t-2 border-t-trait-accent bg-trait-bg/30">
                    <Dna className="size-4 text-trait-accent" />
                    <span className="text-overline text-trait-fg flex-1">
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
                        return (
                          <ScrollReveal key={item.id} delay={cardIndex * 60}>
                            <TiltCard>
                            <Link href={`/items/${item.id}/edit`}>
                              <Card
                                variant="interactive"
                                className="border-l-[3px] border-l-transparent hover:border-l-item-accent"
                              >
                                <CardContent className="flex items-center gap-4 py-4">
                                  <div
                                    className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-item-bg transition-shadow duration-300 group-hover/card:shadow-[0_0_20px_var(--glow-color)]"
                                    style={{ "--glow-color": "var(--item-accent)" } as React.CSSProperties}
                                  >
                                    <FileQuestion className="size-5 text-item-accent" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm line-clamp-2">
                                      {item.stem}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1.5">
                                      <Badge variant="item">
                                        {format?.label ?? item.responseFormatName}
                                      </Badge>
                                      <Badge variant="dot">
                                        <span
                                          className={`size-1.5 rounded-full ${status.dotColor}`}
                                        />
                                        {status.label}
                                      </Badge>
                                    </div>
                                  </div>
                                  <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover/card:opacity-100 transition-opacity shrink-0" />
                                </CardContent>
                              </Card>
                            </Link>
                            </TiltCard>
                          </ScrollReveal>
                        )
                      })}
                    </div>
                  </AccordionPanel>
                </AccordionItem>
              ))}
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
