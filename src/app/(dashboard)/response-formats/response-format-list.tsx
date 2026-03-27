"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import {
  Plus,
  Settings2,
  Search,
  ArrowRight,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { ScrollReveal } from "@/components/scroll-reveal"
import { TiltCard } from "@/components/tilt-card"
import type { ActiveResponseFormatType } from "@/types/database"
import type { ResponseFormatWithMeta } from "@/app/actions/response-formats"

const typeConfig: Record<ActiveResponseFormatType, { label: string }> = {
  likert: { label: "Likert" },
  forced_choice: { label: "Forced Choice" },
  binary: { label: "Binary" },
  free_text: { label: "Free Text" },
  sjt: { label: "SJT" },
}

const allTypes: { value: ActiveResponseFormatType | "all"; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "likert", label: "Likert" },
  { value: "forced_choice", label: "Forced Choice" },
  { value: "binary", label: "Binary" },
  { value: "free_text", label: "Free Text" },
  { value: "sjt", label: "SJT" },
]

export function ResponseFormatList({ formats }: { formats: ResponseFormatWithMeta[] }) {
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<ActiveResponseFormatType | "all">("all")

  const hasFilters = searchQuery !== "" || typeFilter !== "all"

  const filteredFormats = useMemo(() => {
    return formats.filter((f) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (!f.name.toLowerCase().includes(q)) return false
      }
      if (typeFilter !== "all" && f.type !== typeFilter) return false
      return true
    })
  }, [formats, searchQuery, typeFilter])

  function clearFilters() {
    setSearchQuery("")
    setTypeFilter("all")
  }

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        eyebrow="Library"
        title="Response Formats"
        description="Response formats define how candidates interact with assessment items — from Likert scales to situational judgement tasks."
      >
        <Link href="/response-formats/create">
          <Button>
            <Plus className="size-4" />
            Create Format
          </Button>
        </Link>
      </PageHeader>

      {formats.length === 0 ? (
        <EmptyState
          variant="item"
          title="No response formats yet"
          description="Response formats define the answer structure for assessment items. Create your first format to get started."
          actionLabel="Create Format"
          actionHref="/response-formats/create"
        />
      ) : (
        <>
          {/* Search + filters */}
          <div className="space-y-3">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search formats by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Type filter pills */}
              <div className="flex gap-2 flex-wrap">
                {allTypes.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setTypeFilter(value)}
                    className={`inline-flex h-7 items-center rounded-full px-3 text-xs font-medium transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                      typeFilter === value
                        ? "bg-item-bg text-item-fg"
                        : "bg-transparent text-muted-foreground hover:text-foreground border border-border"
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
          </div>

          {filteredFormats.length === 0 ? (
            <div className="flex flex-col items-center py-16">
              <p className="text-sm text-muted-foreground">
                No formats match your filters.
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredFormats.map((format, index) => {
                const type = typeConfig[format.type as ActiveResponseFormatType]

                return (
                  <ScrollReveal key={format.id} delay={index * 60}>
                    <TiltCard>
                      <Link href={`/response-formats/${format.id}/edit`}>
                        <Card variant="interactive">
                          <CardContent className="p-5">
                            <div className="flex items-start gap-3">
                              <div
                                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-item-bg transition-shadow duration-300 group-hover/card:shadow-[0_0_20px_var(--glow-color)]"
                                style={{ "--glow-color": "var(--item-accent)" } as React.CSSProperties}
                              >
                                <Settings2 className="size-5 text-item-accent" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm truncate">
                                  {format.name}
                                </p>
                                <p className="text-caption text-muted-foreground mt-0.5">
                                  {format.itemCount} item{format.itemCount === 1 ? "" : "s"}
                                </p>
                              </div>
                              <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover/card:opacity-100 transition-opacity shrink-0 mt-1" />
                            </div>
                            <div className="flex items-center gap-2 mt-4">
                              <Badge variant="item">
                                {type?.label ?? format.type}
                              </Badge>
                              <Badge variant="dot">
                                <span
                                  className={`size-1.5 rounded-full ${
                                    format.isActive ? "bg-emerald-500" : "bg-muted-foreground/40"
                                  }`}
                                />
                                {format.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    </TiltCard>
                  </ScrollReveal>
                )
              })}
            </div>
          )}

          <p className="text-caption text-muted-foreground text-center">
            Showing {filteredFormats.length} of {formats.length} format{formats.length === 1 ? "" : "s"}
          </p>
        </>
      )}
    </div>
  )
}
