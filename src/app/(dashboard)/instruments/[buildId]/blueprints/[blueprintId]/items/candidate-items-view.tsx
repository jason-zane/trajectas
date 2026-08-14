'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, AlertCircle, Zap, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  estimateBurdenSeconds,
  totalTargetItems,
} from '@/lib/instrument/blueprint'
import { auditCoverage } from '@/lib/instrument/blueprint'
import type { BlueprintCell } from '@/lib/instrument/types'
import type {
  InstrumentBlueprintDto,
  InstrumentCandidateItemDto,
} from '@/lib/dal/instrument-mappers'
import {
  generateItemsForBlueprint,
  updateCandidateItemStatus,
} from '@/app/actions/instrument'

interface CandidateItemsViewProps {
  blueprint: InstrumentBlueprintDto
  cells: BlueprintCell[]
  items: InstrumentCandidateItemDto[]
}

interface CellGroup {
  cellId: string
  facetLabel: string
  intensity: string
  targetCount: number
  actualCount: number
  displayOrder: number
  items: InstrumentCandidateItemDto[]
  deficit: number
}

interface CoverageState {
  complete: number
  total: number
  percentComplete: number
}

function getCoverageStatus(
  actual: number,
  target: number
): 'empty' | 'under' | 'met' | 'over' {
  if (actual === 0) return 'empty'
  if (actual < target) return 'under'
  if (actual === target) return 'met'
  return 'over'
}

function getCoverageColor(status: 'empty' | 'under' | 'met' | 'over'): string {
  switch (status) {
    case 'empty':
      return 'text-destructive border-destructive/40 bg-destructive/5'
    case 'under':
      return 'text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/5'
    case 'met':
      return 'text-emerald-600 dark:text-emerald-400 border-emerald-500/40 bg-emerald-500/5'
    case 'over':
      return 'text-blue-600 dark:text-blue-400 border-blue-500/40 bg-blue-500/5'
  }
}

function getCoverageLabel(status: 'empty' | 'under' | 'met' | 'over'): string {
  switch (status) {
    case 'empty':
      return 'No items'
    case 'under':
      return 'Under target'
    case 'met':
      return 'Complete'
    case 'over':
      return 'Over target'
  }
}

export function CandidateItemsView({
  blueprint,
  cells,
  items,
}: CandidateItemsViewProps) {
  const [itemStatuses, setItemStatuses] = useState<Record<string, string>>(
    items.reduce((acc, item) => ({ ...acc, [item.id]: item.status }), {})
  )
  const [isPending, startTransition] = useTransition()
  const [isGenerating, setIsGenerating] = useState(false)

  // Group items by cell
  const cellGroups: CellGroup[] = cells.map((cell) => {
    const cellItems = items.filter((item) => item.blueprintCellId === cell.id)
    return {
      cellId: cell.id,
      facetLabel: cell.facetLabel,
      intensity: cell.intensity,
      targetCount: cell.targetItemCount,
      actualCount: cellItems.length,
      displayOrder: cell.displayOrder,
      items: cellItems,
      deficit: Math.max(0, cell.targetItemCount - cellItems.length),
    }
  }).sort((a, b) => a.displayOrder - b.displayOrder)

  // Calculate coverage statistics
  const coverage = auditCoverage(cells, items)
  const completeCells = cellGroups.filter(
    (g) => g.actualCount >= g.targetCount
  ).length
  const totalCells = cellGroups.length
  const totalTarget = totalTargetItems(cells)
  const currentTotal = items.length
  const burden = estimateBurdenSeconds(totalTarget)

  const coverageState: CoverageState = {
    complete: completeCells,
    total: totalCells,
    percentComplete: totalCells > 0 ? Math.round((completeCells / totalCells) * 100) : 0,
  }

  const hasDeficits = cellGroups.some((g) => g.deficit > 0)

  const handleGenerateAll = () => {
    setIsGenerating(true)
    startTransition(async () => {
      try {
        const result = await generateItemsForBlueprint(blueprint.id)
        toast.success(`Generated ${result.generated} items`, {
          description: `${result.byCell.filter((c) => c.generated > 0).length} cells updated`,
        })

        // Refresh the page
        window.location.reload()
      } catch (error) {
        toast.error('Generation failed', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      } finally {
        setIsGenerating(false)
      }
    })
  }

  const handleGenerateCell = (cellId: string) => {
    setIsGenerating(true)
    startTransition(async () => {
      try {
        const result = await generateItemsForBlueprint(blueprint.id, {
          cellIds: [cellId],
        })

        if (result.generated > 0) {
          toast.success(`Generated ${result.generated} items for this cell`)
          window.location.reload()
        } else {
          toast.info('No items generated', {
            description: result.byCell[0]?.warnings?.[0] || 'Cell may already be complete',
          })
        }
      } catch (error) {
        toast.error('Generation failed', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      } finally {
        setIsGenerating(false)
      }
    })
  }

  const handleStatusChange = (itemId: string, newStatus: string) => {
    startTransition(async () => {
      try {
        await updateCandidateItemStatus(itemId, { status: newStatus })
        setItemStatuses((prev) => ({ ...prev, [itemId]: newStatus }))
        toast.success(`Item ${newStatus}`)
      } catch (error) {
        toast.error('Status update failed', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    })
  }

  return (
    <div className="space-y-6 p-6">
      {/* Page header */}
      <PageHeader
        title="Candidate Items"
        description="Review and validate items generated for each blueprint cell. Items are provisional until accepted."
        eyebrow="Blueprint"
      />

      {/* Provisional notice */}
      <Alert className="border-amber-500/40 bg-amber-500/5">
        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertDescription className="text-sm text-amber-600 dark:text-amber-400">
          These items are provisional — no respondent has answered them yet. Accept or reject
          each item before publishing.
        </AlertDescription>
      </Alert>

      {/* Orphaned items. blueprint_cell_id is ON DELETE SET NULL, so removing a
          cell detaches its items. Without this they would silently disappear
          from a view organised entirely by cell. */}
      {coverage.unassignedItemCount > 0 && (
        <Alert className="border-destructive/40 bg-destructive/5">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <AlertDescription className="text-sm text-destructive">
            {coverage.unassignedItemCount}{' '}
            {coverage.unassignedItemCount === 1 ? 'item is' : 'items are'} not attached to any
            blueprint cell — most likely the cell was deleted after the items were generated.
            They are not counted in coverage below and will not be published.
          </AlertDescription>
        </Alert>
      )}

      {/* Summary strip */}
      <Card className="p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-overline text-xs font-semibold tracking-wider text-muted-foreground">
              Items
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {currentTotal} / {totalTarget}
            </p>
          </div>
          <div>
            <p className="text-overline text-xs font-semibold tracking-wider text-muted-foreground">
              Cells Complete
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {completeCells} / {totalCells}
            </p>
          </div>
          <div>
            <p className="text-overline text-xs font-semibold tracking-wider text-muted-foreground">
              Coverage
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {coverageState.percentComplete}%
            </p>
          </div>
          <div>
            <p className="text-overline text-xs font-semibold tracking-wider text-muted-foreground">
              Est. Burden (at target)
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {Math.round(burden / 60)}m
            </p>
          </div>
        </div>
      </Card>

      {/* Action bar */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleGenerateAll}
          disabled={!hasDeficits || isPending || isGenerating}
          size="lg"
          className="gap-2"
        >
          <Zap className="h-4 w-4" />
          {isGenerating ? 'Generating...' : 'Generate Missing Items'}
        </Button>
        {!hasDeficits && (
          <Badge variant="outline" className="text-xs font-normal">
            All cells complete
          </Badge>
        )}
      </div>

      {/* Cell groups */}
      <div className="space-y-4">
        {cellGroups.length === 0 ? (
          <Card className="p-8">
            <div className="text-center">
              <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">No blueprint cells</p>
              <p className="text-xs text-muted-foreground">
                Create cells in the blueprint editor first
              </p>
            </div>
          </Card>
        ) : (
          cellGroups.map((group) => {
            const status = getCoverageStatus(group.actualCount, group.targetCount)
            const statusColor = getCoverageColor(status)
            const statusLabel = getCoverageLabel(status)

            return (
              <Card key={group.cellId} className="overflow-hidden">
                {/* Cell header */}
                <div className="border-b bg-muted/30 px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-baseline gap-2">
                        <h3 className="text-sm font-semibold">{group.facetLabel}</h3>
                        <Badge variant="outline" className="text-xs">
                          {group.intensity}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="font-mono">
                          {group.actualCount} / {group.targetCount}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-xs font-normal ${statusColor}`}
                        >
                          {statusLabel}
                        </Badge>
                        {group.deficit > 0 && (
                          <span className="text-destructive">
                            {group.deficit} needed
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Per-cell generate button */}
                    {group.deficit > 0 && (
                      <Button
                        onClick={() => handleGenerateCell(group.cellId)}
                        disabled={isPending || isGenerating}
                        size="sm"
                        variant="outline"
                        className="gap-2"
                      >
                        <Zap className="h-3.5 w-3.5" />
                        Generate
                      </Button>
                    )}
                  </div>
                </div>

                {/* Items list */}
                {group.items.length === 0 ? (
                  <div className="px-6 py-8">
                    <div className="text-center">
                      <AlertCircle className="mx-auto h-6 w-6 text-muted-foreground" />
                      <p className="mt-2 text-sm font-medium">No items generated</p>
                      <p className="text-xs text-muted-foreground">
                        Generate items to fill this cell
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y">
                    {group.items.map((item) => {
                      const currentStatus = itemStatuses[item.id] || item.status
                      const isRejected = currentStatus === 'rejected'

                      return (
                        <div
                          key={item.id}
                          className={`px-6 py-4 transition-opacity ${
                            isRejected ? 'opacity-50' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-1">
                              <div className="flex items-start gap-2">
                                <p className="flex-1 text-sm leading-relaxed">
                                  {item.stem}
                                </p>
                                {item.reverseScored && (
                                  <Badge variant="secondary" className="mt-0.5 shrink-0 text-xs">
                                    R
                                  </Badge>
                                )}
                              </div>
                              {item.rationale && (
                                <p className="text-xs text-muted-foreground italic">
                                  {item.rationale}
                                </p>
                              )}
                            </div>

                            {/* Status controls */}
                            <div className="flex items-center gap-2 shrink-0">
                              {currentStatus === 'accepted' ? (
                                <Badge
                                  variant="outline"
                                  className="border-emerald-500/40 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
                                >
                                  <CheckCircle2 className="mr-1 h-3 w-3" />
                                  Accepted
                                </Badge>
                              ) : currentStatus === 'rejected' ? (
                                <Badge
                                  variant="outline"
                                  className="border-destructive/40 bg-destructive/5 text-destructive"
                                >
                                  <X className="mr-1 h-3 w-3" />
                                  Rejected
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">
                                  Review
                                </Badge>
                              )}

                              {currentStatus !== 'accepted' && (
                                <Button
                                  onClick={() =>
                                    handleStatusChange(item.id, 'accepted')
                                  }
                                  disabled={isPending}
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 gap-1 px-2"
                                  title="Accept"
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                              )}

                              {currentStatus !== 'rejected' && (
                                <Button
                                  onClick={() =>
                                    handleStatusChange(item.id, 'rejected')
                                  }
                                  disabled={isPending}
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 gap-1 px-2 text-destructive hover:text-destructive"
                                  title="Reject"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
