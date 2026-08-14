'use client'

/**
 * alpha-forecast-panel.tsx — live reliability forecast for a blueprint.
 *
 * Recomputes client-side as the grid is edited. Everything it renders is a
 * FORECAST derived from blueprint structure alone — no respondent has answered
 * anything. The panel is deliberately styled so it can never be mistaken for an
 * observed statistic: no green ticks, an explicit "no response data" provenance
 * line, and a dashed border that visually separates it from measured values.
 */

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  forecastAlpha,
  designAdvice,
  classifyMeanInterItem,
  getBandDefinition,
  type CoherenceBand,
} from '@/lib/instrument/reliability'
import { totalTargetItems, facetCount as countFacets } from '@/lib/instrument/blueprint'
import type { BlueprintCell } from '@/lib/instrument/types'
import { recordAlphaForecast } from '@/app/actions/instrument'

interface AlphaForecastPanelProps {
  blueprintId: string
  cells: BlueprintCell[]
  /** Target alpha for this blueprint; defaults to 0.80. */
  initialTargetAlpha?: number
}

const BAND_TONE: Record<CoherenceBand, string> = {
  incoherent: 'text-destructive border-destructive/40 bg-destructive/5',
  broad: 'text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/5',
  optimal: 'text-emerald-600 dark:text-emerald-400 border-emerald-500/40 bg-emerald-500/5',
  narrow: 'text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/5',
  redundant: 'text-destructive border-destructive/40 bg-destructive/5',
}

const BAND_LABEL: Record<CoherenceBand, string> = {
  incoherent: 'Incoherent',
  broad: 'Broad',
  optimal: 'Optimal',
  narrow: 'Narrow',
  redundant: 'Redundant',
}

function pct(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : '—'
}

export function AlphaForecastPanel({
  blueprintId,
  cells,
  initialTargetAlpha = 0.8,
}: AlphaForecastPanelProps) {
  const [targetAlpha, setTargetAlpha] = useState(initialTargetAlpha)
  const [isSaving, startSaving] = useTransition()

  const itemCount = useMemo(() => totalTargetItems(cells), [cells])
  const facets = useMemo(() => countFacets(cells), [cells])

  const forecast = useMemo(
    () => forecastAlpha({ itemCount, facetCount: facets }),
    [itemCount, facets],
  )

  const advice = useMemo(
    () => designAdvice({ itemCount, facetCount: facets, targetAlpha }),
    [itemCount, facets, targetAlpha],
  )

  const band = Number.isFinite(forecast.meanInterItemR)
    ? classifyMeanInterItem(forecast.meanInterItemR)
    : 'incoherent'
  const bandDef = getBandDefinition(band)
  const isRedundant = band === 'redundant'
  const hasItems = itemCount >= 2

  function handleSave() {
    startSaving(async () => {
      try {
        await recordAlphaForecast(blueprintId)
        toast.success('Forecast recorded', {
          description: 'Saved to the evidence ledger as a-priori evidence.',
        })
      } catch (error) {
        toast.error('Could not record forecast', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    })
  }

  return (
    <Card className="border-dashed p-6">
      {/* Provenance — load-bearing. This is a forecast, never a measurement. */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Reliability forecast</h3>
          <p className="text-muted-foreground mt-1 text-xs">
            Forecast — no response data. Predicted from blueprint structure, not measured.
          </p>
        </div>
        <Badge variant="outline" className="shrink-0 text-xs font-normal">
          a priori
        </Badge>
      </div>

      {!hasItems ? (
        <p className="text-muted-foreground mt-6 text-sm">
          Add at least two items to the grid to see a forecast.
        </p>
      ) : (
        <>
          {/* Predicted alpha, as a range — never a bare point estimate. */}
          <div className="mt-6">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold tabular-nums tracking-tight">
                {pct(forecast.interval[0])}–{pct(forecast.interval[1])}
              </span>
              <span className="text-muted-foreground text-sm">predicted α</span>
            </div>
            <p className="text-muted-foreground mt-1 text-xs tabular-nums">
              point estimate {pct(forecast.predictedAlpha)} · {itemCount} items ·{' '}
              {facets} {facets === 1 ? 'facet' : 'facets'} · r̄ ≈ {pct(forecast.meanInterItemR)}
            </p>
          </div>

          {/* Coherence band */}
          <div className="mt-4">
            <Tooltip>
              <TooltipTrigger
                className={`inline-flex cursor-default items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-medium ${BAND_TONE[band]}`}
              >
                {BAND_LABEL[band]} coherence
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                {bandDef?.description ?? 'Mean inter-item correlation band.'}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* The redundancy ceiling — a warning, not a goal. */}
          {isRedundant && (
            <div className="border-destructive/40 bg-destructive/5 mt-4 rounded-md border p-3">
              <p className="text-destructive text-xs font-medium">
                Above the redundancy ceiling
              </p>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                A mean inter-item correlation above 0.50 means the items are near-paraphrases
                of each other. High α here is a warning, not an achievement — the scale is
                measuring a narrower slice of the construct than the blueprint claims. Add
                facet breadth rather than more items.
              </p>
            </div>
          )}

          {/* Target and advice */}
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="target-alpha" className="text-xs">
                Target α
              </Label>
              <span className="text-xs font-medium tabular-nums">{targetAlpha.toFixed(2)}</span>
            </div>
            <Slider
              id="target-alpha"
              min={0.5}
              max={0.95}
              step={0.01}
              value={[targetAlpha]}
              onValueChange={(v) =>
                setTargetAlpha(typeof v === 'number' ? v : (v[0] ?? 0.8))
              }
            />
            <div
              className={`rounded-md border p-3 text-xs leading-relaxed ${
                advice.achievable
                  ? 'text-muted-foreground'
                  : 'border-destructive/40 bg-destructive/5 text-destructive'
              }`}
            >
              {advice.message}
              {advice.achievable && typeof advice.itemsToAdd === 'number' && advice.itemsToAdd > 0 && (
                <span className="text-foreground font-medium">
                  {' '}
                  Add {advice.itemsToAdd} {advice.itemsToAdd === 1 ? 'item' : 'items'}.
                </span>
              )}
            </div>
          </div>

          {/* Forecast warnings */}
          {forecast.warnings.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {forecast.warnings.map((w, i) => (
                <li key={i} className="text-muted-foreground text-xs leading-relaxed">
                  <span
                    className={
                      w.level === 'warn'
                        ? 'text-destructive font-medium'
                        : 'font-medium text-amber-600 dark:text-amber-400'
                    }
                  >
                    {w.level === 'warn' ? 'Warning' : 'Caution'}:
                  </span>{' '}
                  {w.message}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6 flex items-center justify-between gap-3">
            <p className="text-muted-foreground text-xs">
              Basis: {forecast.basis === 'synthetic' ? 'simulated responses' : 'facet-count prior'}
            </p>
            <Button size="sm" variant="outline" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Recording…' : 'Record to evidence ledger'}
            </Button>
          </div>
        </>
      )}
    </Card>
  )
}
