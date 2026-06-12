'use client'

import { useMemo } from 'react'
import { TrajectoryTimeline } from '@/components/trajectory/trajectory-timeline'
import { EmptyState } from '@/components/empty-state'
import {
  comparisonLede,
  monthYear,
  soloLede,
  statsFor,
} from '@/lib/canvas/summarize'
import { OVERALL_ID, type CanvasResult } from '@/lib/canvas/types'
import type { TrajectorySeries } from '@/lib/trajectory/types'

/**
 * Hero chart: the charted competency over time.
 *
 * Two or more people → one line per person. One person → one line per
 * child of the charted node (dimensions under Overall, factors under a
 * dimension), which is the classic single-person trajectory. The series
 * order matches the people order so line colours align with the chips.
 */

export function CanvasHero({
  result,
  charted,
  chartedName,
  peopleKeys,
  nameByPerson,
}: {
  result: CanvasResult
  charted: string
  chartedName: string
  peopleKeys: string[]
  nameByPerson: Map<string, string>
}) {
  const solo = peopleKeys.length === 1
  const sinceLabel = monthYear(
    result.people.reduce<string | null>(
      (acc, p) =>
        p.firstCompletedAt && (!acc || p.firstCompletedAt < acc) ? p.firstCompletedAt : acc,
      null,
    ),
  )

  const { series, lede } = useMemo(() => {
    if (!solo) {
      const bySeries = new Map(
        result.series
          .filter((s) => s.entityId === charted)
          .map((s) => [s.personKey, s]),
      )
      const series: TrajectorySeries[] = peopleKeys.map((personKey) => ({
        entityId: personKey,
        entityName: nameByPerson.get(personKey) ?? 'Unknown',
        level: 'dimension' as const,
        parentId: null,
        parentName: null,
        additionalParentIds: [],
        points: (bySeries.get(personKey)?.points ?? []).map(toTrajectoryPoint),
        deltas: [],
      }))
      const lede = comparisonLede({
        entityName: chartedName,
        stats: statsFor(result.series, charted, peopleKeys),
        nameByPerson,
        sinceLabel,
      })
      return { series, lede }
    }

    const personKey = peopleKeys[0]
    const children =
      charted === OVERALL_ID
        ? result.entities.filter((e) => e.level === 'dimension')
        : result.entities.filter((e) => e.parentId === charted)
    const charteds = children.length
      ? children.sort((a, b) => a.name.localeCompare(b.name))
      : result.entities.filter((e) => e.id === charted)
    const series: TrajectorySeries[] = charteds.map((entity) => ({
      entityId: entity.id,
      entityName: entity.name,
      level: entity.level,
      parentId: entity.parentId,
      parentName: null,
      additionalParentIds: [],
      points: (
        result.series.find((s) => s.personKey === personKey && s.entityId === entity.id)
          ?.points ?? []
      ).map(toTrajectoryPoint),
      deltas: [],
    }))
    const lede = soloLede({
      childStats: charteds.map((entity) => ({
        name: entity.name,
        delta: statsFor(result.series, entity.id, [personKey])[0]?.delta ?? null,
      })),
      sessionCount: result.people[0]?.completedSessionCount ?? 0,
      sinceLabel,
    })
    return { series, lede }
  }, [result, charted, chartedName, peopleKeys, nameByPerson, solo, sinceLabel])

  const maxPoints = series.reduce((acc, s) => Math.max(acc, s.points.length), 0)
  if (solo && maxPoints < 2) {
    return (
      <EmptyState
        eyebrow="Baseline established"
        title={chartedName}
        description={
          maxPoints === 0
            ? 'No completed assessments yet — the chart appears once the first one finishes.'
            : 'One assessment completed. Movement appears here after the next one.'
        }
        size="sm"
      />
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">{lede}</p>
      <TrajectoryTimeline
        series={series}
        mode="absolute"
        onModeChange={() => {}}
        title={chartedName}
        showModeToggle={false}
        heightPx={420}
      />
    </div>
  )
}

function toTrajectoryPoint(p: CanvasPointLike) {
  return {
    sessionId: p.sessionId,
    campaignId: p.campaignId,
    campaignTitle: p.campaignTitle,
    assessmentId: p.assessmentId,
    assessmentName: p.assessmentName,
    completedAt: p.completedAt,
    attemptNumber: p.attemptNumber,
    scaledScore: p.value,
    rawScore: null,
    percentile: null,
    ciLower: p.ciLower,
    ciUpper: p.ciUpper,
    reliability: null,
    normGroupId: null,
    normGroupName: null,
  }
}

type CanvasPointLike = {
  sessionId: string
  completedAt: string
  assessmentId: string
  assessmentName: string
  campaignId: string
  campaignTitle: string
  attemptNumber: number
  value: number
  ciLower: number | null
  ciUpper: number | null
}
