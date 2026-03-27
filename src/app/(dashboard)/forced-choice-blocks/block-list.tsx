"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import {
  Plus,
  Layers,
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
import type { BlockWithMeta } from "@/app/actions/forced-choice-blocks"

export function BlockList({ blocks }: { blocks: BlockWithMeta[] }) {
  const [searchQuery, setSearchQuery] = useState("")

  const hasFilters = searchQuery !== ""

  const filteredBlocks = useMemo(() => {
    if (!searchQuery) return blocks
    const q = searchQuery.toLowerCase()
    return blocks.filter((block) => {
      return (
        block.name.toLowerCase().includes(q) ||
        block.itemPreviews.some((p) => p.toLowerCase().includes(q))
      )
    })
  }, [blocks, searchQuery])

  function clearFilters() {
    setSearchQuery("")
  }

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        eyebrow="Library"
        title="Forced Choice Blocks"
        description="Blocks group 3-4 items together for forced-choice presentation. Candidates rank or select from items within each block."
      >
        <Link href="/forced-choice-blocks/create">
          <Button>
            <Plus className="size-4" />
            Create Block
          </Button>
        </Link>
      </PageHeader>

      {blocks.length === 0 ? (
        <EmptyState
          variant="default"
          title="No blocks yet"
          description="Forced choice blocks group items together for comparative presentation during assessments. Create your first block to get started."
          actionLabel="Create Block"
          actionHref="/forced-choice-blocks/create"
        />
      ) : (
        <>
          {/* Search */}
          <div className="space-y-3">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search blocks by name or item stem..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {hasFilters && (
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-muted-foreground"
                >
                  <X className="size-3.5" />
                  Clear search
                </Button>
              </div>
            )}
          </div>

          {filteredBlocks.length === 0 ? (
            <div className="flex flex-col items-center py-16">
              <p className="text-sm text-muted-foreground">
                No blocks match your search.
              </p>
              {hasFilters && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={clearFilters}
                  className="mt-2"
                >
                  Clear search
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredBlocks.map((block, index) => (
                <ScrollReveal key={block.id} delay={index * 60}>
                  <TiltCard>
                    <Link href={`/forced-choice-blocks/${block.id}/edit`}>
                      <Card variant="interactive">
                        <CardContent className="p-5 space-y-3">
                          <div className="flex items-start gap-3">
                            <div
                              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-shadow duration-300 group-hover/card:shadow-[0_0_20px_var(--glow-color)]"
                              style={{ "--glow-color": "var(--primary)" } as React.CSSProperties}
                            >
                              <Layers className="size-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate">
                                {block.name}
                              </p>
                              <Badge variant="secondary" className="mt-1">
                                {block.itemCount} {block.itemCount === 1 ? "item" : "items"}
                              </Badge>
                            </div>
                            <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover/card:opacity-100 transition-opacity shrink-0 mt-1" />
                          </div>

                          {block.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {block.description}
                            </p>
                          )}

                          {block.itemPreviews.length > 0 && (
                            <div className="space-y-1.5 pt-1 border-t border-border/50">
                              {block.itemPreviews.map((stem, i) => (
                                <p
                                  key={i}
                                  className="text-xs text-muted-foreground line-clamp-1 pl-2 border-l-2 border-primary/20"
                                >
                                  {stem}
                                </p>
                              ))}
                              {block.itemCount > 2 && (
                                <p className="text-caption text-muted-foreground/60">
                                  +{block.itemCount - 2} more
                                </p>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  </TiltCard>
                </ScrollReveal>
              ))}
            </div>
          )}

          <p className="text-caption text-muted-foreground text-center">
            Showing {filteredBlocks.length} of {blocks.length} blocks
          </p>
        </>
      )}
    </div>
  )
}
