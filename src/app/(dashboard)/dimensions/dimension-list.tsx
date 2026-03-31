"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { ArrowRight, LayoutGrid, Layers, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/empty-state"
import { LibraryBulkImportButton } from "@/components/library-bulk-import-button"
import { LibraryBundleImportButton } from "@/components/library-bundle-import-button"
import { LibraryCardSelectButton } from "@/components/library-card-select-button"
import { LibraryInlineDeleteButton } from "@/components/library-inline-delete-button"
import { LibrarySelectionToolbar } from "@/components/library-selection-toolbar"
import { PageHeader } from "@/components/page-header"
import { ScrollReveal } from "@/components/scroll-reveal"
import { TiltCard } from "@/components/tilt-card"
import {
  deleteDimension,
  deleteDimensions,
  restoreDimension,
  restoreDimensions,
  type DimensionWithCounts,
} from "@/app/actions/dimensions"

export function DimensionList({ dimensions }: { dimensions: DimensionWithCounts[] }) {
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isDeleting, startDeleteTransition] = useTransition()

  const allVisibleSelected = useMemo(
    () => dimensions.length > 0 && dimensions.every((dimension) => selectedIds.includes(dimension.id)),
    [dimensions, selectedIds]
  )

  function toggleSelected(id: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? Array.from(new Set([...current, id])) : current.filter((value) => value !== id)
    )
  }

  function toggleAllVisible() {
    setSelectedIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !dimensions.some((dimension) => dimension.id === id))
        : Array.from(new Set([...current, ...dimensions.map((dimension) => dimension.id)]))
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
      const result = await deleteDimensions(idsToRestore)
      if (result && "error" in result && result.error) {
        toast.error(result.error)
        return
      }

      setConfirmOpen(false)
      setSelectedIds([])
      toast.success(`Deleted ${result?.count ?? idsToRestore.length} dimensions`, {
        action: {
          label: "Undo",
          onClick: async () => {
            const restoreResult = await restoreDimensions(idsToRestore)
            if (restoreResult && "error" in restoreResult && restoreResult.error) {
              toast.error(restoreResult.error)
              return
            }
            toast.success(`Restored ${restoreResult?.count ?? idsToRestore.length} dimensions`)
          },
        },
        duration: 5000,
      })
    })
  }

  return (
    <div className="max-w-5xl space-y-8">
      <PageHeader
        eyebrow="Library"
        title="Dimensions"
        description="Dimensions are top-level groupings that organise your factors into meaningful clusters for assessment and reporting."
      >
        <div className="flex items-center gap-2">
          <LibraryBundleImportButton />
          <LibraryBulkImportButton entity="dimensions" />
          <Link href="/dimensions/create">
            <Button>
              <Plus className="size-4" />
              Create Dimension
            </Button>
          </Link>
        </div>
      </PageHeader>

      {dimensions.length === 0 ? (
        <EmptyState
          variant="dimension"
          title="No dimensions yet"
          description="Dimensions help you organise factors into logical groups. Create your first dimension to get started."
          actionLabel="Create Dimension"
          actionHref="/dimensions/create"
        />
      ) : (
        <>
          <div className="flex justify-end">
            <LibrarySelectionToolbar
              selectionMode={selectionMode}
              selectedCount={selectedIds.length}
              visibleCount={dimensions.length}
              allVisibleSelected={allVisibleSelected}
              itemLabel="dimension"
              itemLabelPlural="dimensions"
              deleting={isDeleting}
              confirmOpen={confirmOpen}
              onConfirmOpenChange={setConfirmOpen}
              onToggleSelectionMode={toggleSelectionMode}
              onToggleAllVisible={toggleAllVisible}
              onClearSelection={clearSelection}
              onConfirmDelete={handleBulkDelete}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {dimensions.map((dimension, index) => (
              <ScrollReveal key={dimension.id} delay={index * 60}>
                <TiltCard>
                  <div className="group relative">
                    {selectionMode ? (
                      <div className="absolute top-3 right-3 z-10">
                        <LibraryCardSelectButton
                          label={dimension.name}
                          selected={selectedIds.includes(dimension.id)}
                          onToggle={() =>
                            toggleSelected(dimension.id, !selectedIds.includes(dimension.id))
                          }
                        />
                      </div>
                    ) : null}
                    {!selectionMode ? (
                      <div className="absolute top-3 right-3 z-10 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                        <LibraryInlineDeleteButton
                          itemLabel="Dimension"
                          itemName={dimension.name}
                          onDelete={() => deleteDimension(dimension.id)}
                          onRestore={() => restoreDimension(dimension.id)}
                        />
                      </div>
                    ) : null}
                    <Link href={`/dimensions/${dimension.slug}/edit`}>
                      <Card
                        variant="interactive"
                        className="border-l-[3px] border-l-dimension-accent"
                      >
                        <CardHeader>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div
                                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-dimension-bg transition-all duration-300 group-hover/card:shadow-[0_0_20px_var(--glow-color)]"
                                style={{ "--glow-color": "var(--dimension-accent)" } as React.CSSProperties}
                              >
                                <LayoutGrid className="size-5 text-dimension-accent" />
                              </div>
                              <div>
                                <CardTitle>{dimension.name}</CardTitle>
                                <div className="mt-1 flex items-center gap-2">
                                  <Badge variant="dot">
                                    <span
                                      className={`size-1.5 rounded-full ${dimension.isActive ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                                    />
                                    {dimension.isActive ? "Active" : "Inactive"}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            <ArrowRight className="mt-1 size-4 text-muted-foreground opacity-0 transition-opacity group-hover/card:opacity-100" />
                          </div>
                        </CardHeader>
                        <CardContent>
                          {dimension.description && (
                            <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">
                              {dimension.description}
                            </p>
                          )}
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Layers className="size-3.5" />
                            <span>
                              {dimension.factorCount} {dimension.factorCount === 1 ? "factor" : "factors"}
                            </span>
                          </div>
                          <div className="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-border">
                            <div
                              className="h-full rounded-full bg-dimension-accent transition-all"
                              style={{
                                width: `${Math.min((dimension.factorCount / 10) * 100, 100)}%`,
                                opacity: 0.6,
                              }}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </div>
                </TiltCard>
              </ScrollReveal>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
