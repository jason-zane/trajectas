'use client'

/**
 * evidence-view.tsx — congruence panel + fairness screen results.
 *
 * Displays a-priori evidence from blind AI raters: assignment accuracy (per-item
 * and panel), Aiken’s V (relevance), Fleiss' kappa (inter-rater reliability), and
 * per-item confusion profiles. Fairness screens include reading grade and idiom/
 * metaphor flagging.
 *
 * All evidence is labeled "a priori — from AI raters, not respondent data". The
 * confusion matrix highlights the biggest off-diagonal (construct confusion), and
 * the item table allows sorting by verdict (failures first) for quick remediation.
 */

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ArrowUpDown, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  runCongruencePanelForBuild,
  runFairnessScreenForBuild,
} from '@/app/actions/instrument'
import type { InstrumentBuildDto, InstrumentBlueprintDto, InstrumentCandidateItemDto } from '@/lib/dal/instrument-mappers'
import type { PanelResult, ItemCongruence } from '@/lib/instrument/congruence'

interface EvidenceViewProps {
  buildId: string
  build: InstrumentBuildDto
  blueprints: InstrumentBlueprintDto[]
  panelResult: PanelResult | null
  candidateItems: InstrumentCandidateItemDto[]
}

type SortKey = 'verdict' | 'accuracy' | 'stem' | 'readingGrade'

export function EvidenceView({
  buildId,
  blueprints,
  panelResult,
  candidateItems,
}: EvidenceViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>('verdict')
  const [isRunningCongruence, startCongruence] = useTransition()
  const [isRunningFairness, startFairness] = useTransition()

  const canRunCongruence = blueprints.length >= 2
  const itemsWithCongruence = useMemo(() => {
    const map = new Map<string, ItemCongruence>()
    if (!panelResult) return map
    for (const item of panelResult.items) {
      map.set(item.itemId, item)
    }
    return map
  }, [panelResult])

  // Sort items for display
  const sortedItems = useMemo(() => {
    const items = [...candidateItems]

    switch (sortKey) {
      case 'verdict': {
        const verdictOrder: Record<string, number> = { fail: 0, review: 1, pass: 2 }
        items.sort((a, b) => {
          const aCongruence = itemsWithCongruence.get(a.id)
          const bCongruence = itemsWithCongruence.get(b.id)
          const aVerdictOrder = verdictOrder[aCongruence?.verdict ?? 'fail'] ?? 3
          const bVerdictOrder = verdictOrder[bCongruence?.verdict ?? 'fail'] ?? 3
          if (aVerdictOrder !== bVerdictOrder) return aVerdictOrder - bVerdictOrder
          return a.stem.localeCompare(b.stem)
        })
        break
      }
      case 'accuracy': {
        items.sort((a, b) => {
          const aAccuracy = itemsWithCongruence.get(a.id)?.assignmentAccuracy ?? 0
          const bAccuracy = itemsWithCongruence.get(b.id)?.assignmentAccuracy ?? 0
          return aAccuracy - bAccuracy
        })
        break
      }
      case 'readingGrade': {
        const getGrade = (item: InstrumentCandidateItemDto): number => {
          if (typeof item.payload === 'object' && item.payload !== null && 'fairness' in item.payload) {
            const fairness = (item.payload as Record<string, unknown>).fairness
            if (typeof fairness === 'object' && fairness !== null && 'readingGrade' in fairness) {
              return Number((fairness as Record<string, unknown>).readingGrade) || 0
            }
          }
          return 0
        }
        items.sort((a, b) => getGrade(a) - getGrade(b))
        break
      }
      case 'stem':
      default:
        items.sort((a, b) => a.stem.localeCompare(b.stem))
    }

    return items
  }, [candidateItems, sortKey, itemsWithCongruence])

  function handleRunCongruence() {
    if (!canRunCongruence) return

    startCongruence(async () => {
      try {
        const result = await runCongruencePanelForBuild(buildId, { raterCount: 3 })
        if (result.warnings.length > 0) {
          toast.warning('Congruence panel completed with warnings', {
            description: `${result.itemsRated} items rated; ${result.warnings.length} warning(s).`,
          })
        } else {
          toast.success('Congruence panel completed', {
            description: `${result.itemsRated} items rated; ${result.ratingsRecorded} ratings recorded.`,
          })
        }
        // Trigger a page refresh to fetch updated results
        setTimeout(() => window.location.reload(), 1500)
      } catch (error) {
        toast.error('Could not run congruence panel', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    })
  }

  function handleRunFairness() {
    startFairness(async () => {
      try {
        const result = await runFairnessScreenForBuild(buildId)
        toast.success('Fairness screen completed', {
          description: `${result.itemsScreened} items screened; ${result.flagged} flagged.`,
        })
        setTimeout(() => window.location.reload(), 1500)
      } catch (error) {
        toast.error('Could not run fairness screen', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    })
  }

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        eyebrow="Evidence"
        title="Congruence & Fairness"
        description="A-priori evidence from AI raters — not respondent data, not human SMEs."
      />

      {/* Run controls */}
      <Card className="border-dashed p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold">Run evidence stages</h3>
            <p className="text-muted-foreground mt-1 text-xs">
              Blind multi-rater analysis + readability screening.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleRunCongruence}
              disabled={isRunningCongruence || !canRunCongruence}
            >
              {isRunningCongruence ? 'Running…' : 'Run congruence panel'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRunFairness}
              disabled={isRunningFairness}
            >
              {isRunningFairness ? 'Screening…' : 'Run fairness screen'}
            </Button>
          </div>
        </div>

        {!canRunCongruence && (
          <Alert className="border-amber-500/40 bg-amber-500/5 mt-4">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-700 dark:text-amber-400 text-xs">
              Congruence panel requires at least 2 constructs to discriminate between. Add another blueprint to enable.
            </AlertDescription>
          </Alert>
        )}
      </Card>

      {panelResult ? (
        <>
          {/* Headline metrics */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card className="p-4">
              <div className="text-xs font-mono uppercase tracking-wide text-muted-foreground">
                Assignment Accuracy
              </div>
              <div className="mt-2 text-2xl font-semibold tabular-nums">
                {(panelResult.overall.meanAccuracy * 100).toFixed(0)}%
              </div>
              <p className="text-muted-foreground mt-1 text-xs">
                avg. of {panelResult.overall.itemCount} items
              </p>
            </Card>

            <Card className="p-4">
              <div className="text-xs font-mono uppercase tracking-wide text-muted-foreground">
                Fleiss’ Kappa
              </div>
              <div className="mt-2 text-2xl font-semibold tabular-nums">
                {panelResult.fleissKappa.toFixed(2)}
              </div>
              <p className="text-muted-foreground mt-1 text-xs">
                inter-rater reliability
              </p>
            </Card>

            <Card className="p-4">
              <div className="text-xs font-mono uppercase tracking-wide text-muted-foreground">
                Mean Aiken’s V
              </div>
              <div className="mt-2 text-2xl font-semibold tabular-nums">
                {panelResult.overall.meanAikenV.toFixed(2)}
              </div>
              <p className="text-muted-foreground mt-1 text-xs">
                content validity
              </p>
            </Card>

            <Card className="p-4">
              <div className="text-xs font-mono uppercase tracking-wide text-muted-foreground">
                Pass Rate
              </div>
              <div className="mt-2 text-2xl font-semibold tabular-nums">
                {(panelResult.overall.passRate * 100).toFixed(0)}%
              </div>
              <p className="text-muted-foreground mt-1 text-xs">
                {Math.round(panelResult.overall.passRate * panelResult.overall.itemCount)} of{' '}
                {panelResult.overall.itemCount} items
              </p>
            </Card>
          </div>

          {/* Confusion matrix */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Construct confusion matrix</h3>
              <Badge variant="outline" className="text-xs font-normal">
                intended × assigned
              </Badge>
            </div>

            <ConfusionMatrixGrid
              confusion={panelResult.confusion}
              blueprints={blueprints}
            />

            {/* Biggest off-diagonal finding */}
            {panelResult.constructSummaries.length > 0 && (
              <div className="mt-4 border-t pt-4">
                <ConfusionMatrixFinding
                  confusion={panelResult.confusion}
                  blueprints={blueprints}
                />
              </div>
            )}
          </Card>

          {/* Item table */}
          <Card className="p-6">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">Item-level results</h3>
              <p className="text-muted-foreground mt-1 text-xs">
                Sort by verdict to find items needing review.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      <SortButton
                        label="Stem"
                        active={sortKey === 'stem'}
                        onClick={() => setSortKey('stem')}
                      />
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      <SortButton
                        label="Verdict"
                        active={sortKey === 'verdict'}
                        onClick={() => setSortKey('verdict')}
                      />
                    </th>
                    <th className="px-3 py-2 text-center font-medium text-muted-foreground">
                      <SortButton
                        label="Accuracy"
                        active={sortKey === 'accuracy'}
                        onClick={() => setSortKey('accuracy')}
                      />
                    </th>
                    <th className="px-3 py-2 text-center font-medium text-muted-foreground">
                      Aiken’s V
                    </th>
                    <th className="px-3 py-2 text-center font-medium text-muted-foreground">
                      <SortButton
                        label="Reading Grade"
                        active={sortKey === 'readingGrade'}
                        onClick={() => setSortKey('readingGrade')}
                      />
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Fairness Flags
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center">
                        <p className="text-muted-foreground text-sm">
                          No candidate items yet.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    sortedItems.map((item) => {
                      const congruence = itemsWithCongruence.get(item.id)
                      const readingGrade = getReadingGrade(item)
                      const fairnessFlags = getFairnessFlags(item)

                      return (
                        <tr key={item.id} className="border-b hover:bg-cream dark:hover:bg-slate-800/50">
                          <td className="px-3 py-3">
                            <div className="line-clamp-2 text-foreground">
                              {item.stem}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            {congruence ? (
                              <VerdictBadge verdict={congruence.verdict} />
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                unrated
                              </Badge>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center tabular-nums">
                            {congruence ? (
                              <span className="font-medium">
                                {(congruence.assignmentAccuracy * 100).toFixed(0)}%
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center tabular-nums">
                            {congruence ? (
                              <span className="font-medium">
                                {congruence.aikenV.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center tabular-nums">
                            {readingGrade !== null ? (
                              <span className="font-medium">{readingGrade.toFixed(1)}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            {fairnessFlags.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {fairnessFlags.map((flag) => (
                                  <Badge
                                    key={flag}
                                    variant="destructive"
                                    className="text-xs font-normal"
                                  >
                                    {flag}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : (
        <div className="space-y-4">
          <EmptyState
            eyebrow="No evidence yet"
            title="Run the congruence panel to begin"
            description="Blind multi-rater analysis will assess item-construct alignment and produce evidence of discriminant validity."
          />
          <div className="flex justify-center">
            <Button
              onClick={handleRunCongruence}
              disabled={isRunningCongruence || !canRunCongruence}
            >
              {isRunningCongruence ? 'Running…' : 'Run congruence panel'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Helpers
// ============================================================================

function SortButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 hover:text-foreground transition-colors"
    >
      {label}
      {active && <ArrowUpDown className="h-3 w-3" />}
    </button>
  )
}

function VerdictBadge({ verdict }: { verdict: 'pass' | 'review' | 'fail' }) {
  const colors = {
    pass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    review: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
    fail: 'bg-destructive/15 text-destructive dark:text-red-400 border-destructive/30',
  }

  const icons = {
    pass: <CheckCircle2 className="h-3 w-3" />,
    review: <Clock className="h-3 w-3" />,
    fail: <AlertTriangle className="h-3 w-3" />,
  }

  const labels = {
    pass: 'Pass',
    review: 'Review',
    fail: 'Fail',
  }

  return (
    <Badge
      variant="outline"
      className={`${colors[verdict]} text-xs font-medium flex items-center gap-1 w-fit`}
    >
      {icons[verdict]}
      {labels[verdict]}
    </Badge>
  )
}

function ConfusionMatrixGrid({
  confusion,
  blueprints,
}: {
  confusion: Record<string, Record<string, number>>
  blueprints: InstrumentBlueprintDto[]
}) {
  const constructs = Array.from(
    new Set(
      Object.keys(confusion)
        .flatMap((k) => [k, ...Object.keys(confusion[k] || {})])
    )
  ).sort()

  if (constructs.length === 0) {
    return <p className="text-muted-foreground text-sm">No confusion data.</p>
  }

  const getConstructLabel = (id: string): string => {
    const bp = blueprints.find((b) => b.id === id)
    return bp?.draftConstructName || bp?.constructId || id.slice(0, 8)
  }

  const maxCount = Math.max(
    ...constructs.flatMap((intended) =>
      Object.values(confusion[intended] || {})
    ),
    1
  )

  return (
    <div className="overflow-x-auto">
      <table className="text-xs">
        <thead>
          <tr>
            <th className="px-2 py-2 text-left font-medium text-muted-foreground">
              Intended
            </th>
            {constructs.map((construct) => (
              <th
                key={construct}
                className="px-2 py-2 text-center font-medium text-muted-foreground whitespace-nowrap"
              >
                {getConstructLabel(construct).slice(0, 12)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {constructs.map((intended) => (
            <tr key={intended}>
              <td className="px-2 py-2 text-left font-medium text-foreground whitespace-nowrap">
                {getConstructLabel(intended).slice(0, 12)}
              </td>
              {constructs.map((assigned) => {
                const count = confusion[intended]?.[assigned] ?? 0
                const intensity = count > 0 ? count / maxCount : 0
                const isCorrect = intended === assigned

                return (
                  <td
                    key={`${intended}-${assigned}`}
                    className={`px-2 py-2 text-center font-medium transition-colors ${
                      isCorrect
                        ? 'bg-emerald-500/20 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                        : intensity > 0.3
                          ? 'bg-amber-500/20 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400'
                          : intensity > 0
                            ? 'bg-slate-100 dark:bg-slate-800 text-foreground'
                            : 'bg-transparent text-muted-foreground'
                    }`}
                  >
                    {count > 0 ? count : '—'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ConfusionMatrixFinding({
  confusion,
  blueprints,
}: {
  confusion: Record<string, Record<string, number>>
  blueprints: InstrumentBlueprintDto[]
}) {
  let maxCount = 0
  let maxIntended = ''
  let maxAssigned = ''

  for (const intended of Object.keys(confusion)) {
    for (const assigned of Object.keys(confusion[intended] || {})) {
      if (intended !== assigned) {
        const count = confusion[intended]?.[assigned] ?? 0
        if (count > maxCount) {
          maxCount = count
          maxIntended = intended
          maxAssigned = assigned
        }
      }
    }
  }

  if (maxCount === 0) {
    return (
      <p className="text-sm text-emerald-600 dark:text-emerald-400">
        No significant construct confusion detected.
      </p>
    )
  }

  const getConstructLabel = (id: string): string => {
    const bp = blueprints.find((b) => b.id === id)
    return bp?.draftConstructName || bp?.constructId || id
  }

  return (
    <p className="text-sm">
      <span className="font-medium text-amber-600 dark:text-amber-400">Biggest confusion:</span>{' '}
      <span className="text-foreground">
        {getConstructLabel(maxIntended)} and {getConstructLabel(maxAssigned)} were
        confused on {maxCount} rating{maxCount === 1 ? '' : 's'}.
      </span>
    </p>
  )
}

function getReadingGrade(item: InstrumentCandidateItemDto): number | null {
  if (typeof item.payload === 'object' && item.payload !== null && 'fairness' in item.payload) {
    const fairness = (item.payload as Record<string, unknown>).fairness
    if (typeof fairness === 'object' && fairness !== null && 'readingGrade' in fairness) {
      const grade = (fairness as Record<string, unknown>).readingGrade
      return typeof grade === 'number' ? grade : null
    }
  }
  return null
}

function getFairnessFlags(item: InstrumentCandidateItemDto): string[] {
  if (typeof item.payload === 'object' && item.payload !== null && 'fairness' in item.payload) {
    const fairness = (item.payload as Record<string, unknown>).fairness
    if (typeof fairness === 'object' && fairness !== null && 'flags' in fairness) {
      const flags = (fairness as Record<string, unknown>).flags
      return Array.isArray(flags) ? flags.map(String) : []
    }
  }
  return []
}
