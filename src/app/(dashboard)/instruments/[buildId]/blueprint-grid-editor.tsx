'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, Plus, X, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes'
import {
  estimateBurdenSeconds,
  facetCount as computeFacetCount,
  totalTargetItems,
  validateBlueprint
} from '@/lib/instrument/blueprint'
import type { BlueprintCell, Intensity } from '@/lib/instrument/types'
import type { InstrumentBlueprintDto } from '@/lib/dal/instrument-mappers'
import {
  saveBlueprintCells,
  draftBlueprintWithAI,
  updateBlueprintAction
} from '@/app/actions/instrument'
import { AlphaForecastPanel } from './alpha-forecast-panel'

const INTENSITIES: Intensity[] = ['low', 'mid', 'high']

interface BlueprintGridEditorProps {
  blueprint: InstrumentBlueprintDto
  initialCells: BlueprintCell[]
}

interface FacetRow {
  facetLabel: string
  facetDefinition: string
  cells: Record<Intensity, number>
  displayOrder: number
}

export function BlueprintGridEditor({
  blueprint,
  initialCells
}: BlueprintGridEditorProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isAIDrafting, setIsAIDrafting] = useState(false)

  // Initialize grid from cells
  const initializeFacets = (): FacetRow[] => {
    const facetMap: Record<string, FacetRow> = {}
    initialCells.forEach((cell) => {
      if (!facetMap[cell.facetLabel]) {
        facetMap[cell.facetLabel] = {
          facetLabel: cell.facetLabel,
          facetDefinition: '',
          cells: { low: 0, mid: 0, high: 0 },
          displayOrder: cell.displayOrder
        }
      }
      facetMap[cell.facetLabel].cells[cell.intensity] = cell.targetItemCount
    })
    return Object.values(facetMap).sort((a, b) => a.displayOrder - b.displayOrder)
  }

  const [facets, setFacets] = useState<FacetRow[]>(initializeFacets())
  const [exclusionsText, setExclusionsText] = useState<string>(
    blueprint.exclusions?.join(', ') || ''
  )
  const [hasChanges, setHasChanges] = useState(false)
  const [validationWarnings, setValidationWarnings] = useState<string[]>([])

  useUnsavedChanges(hasChanges)

  const handleFacetLabelChange = (index: number, value: string) => {
    const newFacets = [...facets]
    newFacets[index].facetLabel = value
    setFacets(newFacets)
    setHasChanges(true)
  }

  const handleFacetDefinitionChange = (index: number, value: string) => {
    const newFacets = [...facets]
    newFacets[index].facetDefinition = value
    setFacets(newFacets)
    setHasChanges(true)
  }

  const handleCellChange = (
    facetIndex: number,
    intensity: Intensity,
    value: string
  ) => {
    const num = parseInt(value, 10)
    if (isNaN(num) || num < 0) return

    const newFacets = [...facets]
    newFacets[facetIndex].cells[intensity] = Math.max(0, num)
    setFacets(newFacets)
    setHasChanges(true)

    // Re-validate
    validateGrid(newFacets)
  }

  const handleAddFacet = () => {
    const newDisplayOrder = Math.max(...facets.map(f => f.displayOrder), -1) + 1
    setFacets([
      ...facets,
      {
        facetLabel: '',
        facetDefinition: '',
        cells: { low: 0, mid: 0, high: 0 },
        displayOrder: newDisplayOrder
      }
    ])
    setHasChanges(true)
  }

  const handleRemoveFacet = (index: number) => {
    const newFacets = facets.filter((_, i) => i !== index)
    setFacets(newFacets)
    setHasChanges(true)
    validateGrid(newFacets)
  }

  const handleMoveFacet = (index: number, direction: 'up' | 'down') => {
    const newFacets = [...facets]
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= newFacets.length) return

    // Swap displayOrder
    const temp = newFacets[index].displayOrder
    newFacets[index].displayOrder = newFacets[swapIndex].displayOrder
    newFacets[swapIndex].displayOrder = temp

    // Re-sort
    newFacets.sort((a, b) => a.displayOrder - b.displayOrder)
    setFacets(newFacets)
    setHasChanges(true)
  }

  const validateGrid = (facetsToValidate: FacetRow[]) => {
    // Convert facets back to cells for validation
    const cells: BlueprintCell[] = []
    let cellId = 0
    facetsToValidate.forEach((facet) => {
      INTENSITIES.forEach((intensity) => {
        if (facet.cells[intensity] > 0) {
          cells.push({
            id: `temp-${cellId++}`,
            facetLabel: facet.facetLabel,
            intensity,
            targetItemCount: facet.cells[intensity],
            displayOrder: facet.displayOrder
          })
        }
      })
    })

    const validation = validateBlueprint(cells)
    setValidationWarnings(validation.warnings)
  }

  const handleDraftWithAI = () => {
    setIsAIDrafting(true)
    startTransition(async () => {
      try {
        const result = await draftBlueprintWithAI(blueprint.id)

        // Parse cells back into facets
        const facetMap: Record<string, FacetRow> = {}
        result.cells.forEach((cell) => {
          if (!facetMap[cell.facetLabel]) {
            facetMap[cell.facetLabel] = {
              facetLabel: cell.facetLabel,
              facetDefinition: '',
              cells: { low: 0, mid: 0, high: 0 },
              displayOrder: cell.displayOrder
            }
          }
          // The action returns intensity as a plain string; only accept known
          // levels so an unexpected value cannot widen the Record key type.
          const intensity = INTENSITIES.find((level) => level === cell.intensity)
          if (intensity) {
            facetMap[cell.facetLabel].cells[intensity] = cell.targetItemCount
          }
        })

        const newFacets = Object.values(facetMap).sort(
          (a, b) => a.displayOrder - b.displayOrder
        )
        setFacets(newFacets)
        setHasChanges(true)
        validateGrid(newFacets)

        if (result.warnings.length > 0) {
          toast.error(`AI draft completed with warnings: ${result.warnings.join('; ')}`)
        } else {
          toast.success('Blueprint drafted with AI')
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to draft blueprint with AI'
        )
      } finally {
        setIsAIDrafting(false)
      }
    })
  }

  const handleSave = () => {
    // Convert facets to cells
    const cells: Array<{
      facetLabel: string
      facetDefinition: string
      intensity: Intensity
      targetItemCount: number
      displayOrder: number
    }> = []

    let displayOrder = 0
    facets.forEach((facet) => {
      INTENSITIES.forEach((intensity) => {
        if (facet.cells[intensity] > 0) {
          cells.push({
            facetLabel: facet.facetLabel,
            facetDefinition: facet.facetDefinition,
            intensity,
            targetItemCount: facet.cells[intensity],
            displayOrder
          })
          displayOrder++
        }
      })
    })

    if (cells.length === 0) {
      toast.error('Blueprint must have at least one cell')
      return
    }

    // Parse exclusions
    const exclusions = exclusionsText
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e.length > 0)

    startTransition(async () => {
      try {
        // Save cells
        await saveBlueprintCells(blueprint.id, { cells })

        // Update blueprint metadata (exclusions, target alpha, notes)
        await updateBlueprintAction(blueprint.id, {
          exclusions,
          targetAlpha: blueprint.targetAlpha
        })

        toast.success('Blueprint saved')
        setHasChanges(false)
        router.refresh()
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to save blueprint'
        )
      }
    })
  }

  const totalItems = totalTargetItems(
    facets.flatMap((facet) =>
      INTENSITIES.map((intensity) => ({
        id: `${facet.facetLabel}-${intensity}`,
        facetLabel: facet.facetLabel,
        intensity,
        targetItemCount: facet.cells[intensity],
        displayOrder: facet.displayOrder
      })).filter((c) => c.targetItemCount > 0)
    )
  )

  const estimatedBurden = estimateBurdenSeconds(totalItems)
  const facetCountValue = computeFacetCount(
    facets.flatMap((facet) =>
      INTENSITIES.map((intensity) => ({
        id: `${facet.facetLabel}-${intensity}`,
        facetLabel: facet.facetLabel,
        intensity,
        targetItemCount: facet.cells[intensity],
        displayOrder: facet.displayOrder
      })).filter((c) => c.targetItemCount > 0)
    )
  )

  return (
    <div className="space-y-8 max-w-full">
      <PageHeader
        eyebrow="Blueprint"
        title={blueprint.draftConstructName || 'Untitled'}
        description={blueprint.draftConstructDefinition || 'Define the blueprint grid'}
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => router.back()}
            disabled={isPending || isAIDrafting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isPending || isAIDrafting}
          >
            {isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Main grid editor */}
        <div className="lg:col-span-2 space-y-6">
          {/* Exclusions editor */}
          <Card className="p-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Exclusions (what this construct is NOT)
              </label>
              <Textarea
                value={exclusionsText}
                onChange={(e) => {
                  setExclusionsText(e.target.value)
                  setHasChanges(true)
                }}
                placeholder="E.g., 'Not social anxiety', 'Not clinical depression', 'Not cognitive ability'"
                rows={3}
              />
              <div className="text-xs text-muted-foreground">
                Comma-separated list of what this construct does NOT measure
              </div>
            </div>
          </Card>

          {/* Validation warnings */}
          {validationWarnings.length > 0 && (
            <Alert>
              <AlertDescription>
                <div className="space-y-1">
                  {validationWarnings.map((warning, i) => (
                    <div key={i} className="text-sm">
                      • {warning}
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Blueprint grid */}
          <Card className="p-6 overflow-x-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Blueprint Grid</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddFacet}
                  disabled={isPending || isAIDrafting}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Facet
                </Button>
              </div>

              <div className="inline-block min-w-full">
                {/* Column headers */}
                <div className="grid gap-1 mb-4" style={{
                  gridTemplateColumns: '200px 200px 100px 100px 100px 80px'
                }}>
                  <div className="font-semibold text-sm text-muted-foreground">Facet</div>
                  <div className="font-semibold text-sm text-muted-foreground">Definition</div>
                  <div className="font-semibold text-sm text-center text-muted-foreground">Low</div>
                  <div className="font-semibold text-sm text-center text-muted-foreground">Mid</div>
                  <div className="font-semibold text-sm text-center text-muted-foreground">High</div>
                  <div className="font-semibold text-sm text-center text-muted-foreground">Actions</div>
                </div>

                {/* Grid rows */}
                {facets.map((facet, idx) => (
                  <div
                    key={idx}
                    className="grid gap-1 pb-4 border-b border-border last:border-b-0"
                    style={{
                      gridTemplateColumns: '200px 200px 100px 100px 100px 80px'
                    }}
                  >
                    <Input
                      placeholder="E.g., Strategic Thinking"
                      value={facet.facetLabel}
                      onChange={(e) => handleFacetLabelChange(idx, e.target.value)}
                      className="text-sm"
                    />
                    <Input
                      placeholder="Brief definition"
                      value={facet.facetDefinition}
                      onChange={(e) => handleFacetDefinitionChange(idx, e.target.value)}
                      className="text-sm"
                    />
                    {INTENSITIES.map((intensity) => (
                      <Input
                        key={intensity}
                        type="number"
                        min="0"
                        value={facet.cells[intensity]}
                        onChange={(e) => handleCellChange(idx, intensity, e.target.value)}
                        className="text-sm text-center"
                      />
                    ))}
                    <div className="flex items-center gap-1 justify-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMoveFacet(idx, 'up')}
                        disabled={idx === 0 || isPending}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMoveFacet(idx, 'down')}
                        disabled={idx === facets.length - 1 || isPending}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveFacet(idx)}
                        disabled={isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* AI Draft button */}
          <Button
            variant="outline"
            onClick={handleDraftWithAI}
            disabled={isPending || isAIDrafting || !blueprint.draftConstructName}
            className="w-full"
          >
            <Zap className="h-4 w-4 mr-2" />
            {isAIDrafting ? 'Drafting…' : 'Draft Grid with AI'}
          </Button>
        </div>

        {/* Right sidebar: metrics and forecast */}
        <div className="space-y-6">
          {/* Live metrics */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Live Metrics</h3>
            <div className="space-y-4">
              <div>
                <div className="text-xs font-mono uppercase tracking-wide text-muted-foreground">
                  Total Items
                </div>
                <div className="mt-1 text-2xl font-bold tabular-nums">
                  {totalItems}
                </div>
              </div>
              <div>
                <div className="text-xs font-mono uppercase tracking-wide text-muted-foreground">
                  Facets
                </div>
                <div className="mt-1 text-2xl font-bold tabular-nums">
                  {facetCountValue}
                </div>
              </div>
              <div>
                <div className="text-xs font-mono uppercase tracking-wide text-muted-foreground">
                  Estimated Burden
                </div>
                <div className="mt-1 text-sm text-foreground">
                  {Math.round(estimatedBurden / 60)} min {estimatedBurden % 60} sec
                </div>
              </div>
            </div>
          </Card>

          {/* Alpha forecast panel */}
          <AlphaForecastPanel
            blueprintId={blueprint.id}
            cells={facets.flatMap((facet) =>
              INTENSITIES.map((intensity) => ({
                id: `${facet.facetLabel}-${intensity}`,
                facetLabel: facet.facetLabel,
                intensity,
                targetItemCount: facet.cells[intensity],
                displayOrder: facet.displayOrder
              })).filter((c) => c.targetItemCount > 0)
            )}
          />
        </div>
      </div>
    </div>
  )
}
