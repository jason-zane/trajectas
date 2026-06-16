'use client'

import { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CanvasRowTrack } from './canvas-row-track'
import {
  isMeaningfulChange,
  biggestChange,
  formatSigned,
  maxAbsChange,
  orderEntities,
  rangeSentence,
  spread,
  statsFor,
  type PersonStat,
} from '@/lib/canvas/summarize'
import {
  OVERALL_ID,
  type CanvasEntity,
  type CanvasOrder,
  type CanvasResult,
} from '@/lib/canvas/types'

/**
 * The breakdown list under the hero: Overall, then one row per dimension,
 * with the open dimension's factor rows beneath it. Clicking a row charts
 * it in the hero; clicking a dimension also opens its factors.
 */

export function CanvasBreakdown({
  result,
  peopleKeys,
  colourClasses,
  nameByPerson,
  showChange,
  order,
  charted,
  openDimension,
  onChart,
}: {
  result: CanvasResult
  peopleKeys: string[]
  colourClasses: string[]
  nameByPerson: Map<string, string>
  showChange: boolean
  order: CanvasOrder
  charted: string
  openDimension: string | null
  onChart: (entityId: string) => void
}) {
  const dimensions = useMemo(
    () => result.entities.filter((e) => e.level === 'dimension'),
    [result.entities],
  )
  const factorsByDimension = useMemo(() => {
    const out = new Map<string, CanvasEntity[]>()
    for (const e of result.entities) {
      if (e.level !== 'factor' || !e.parentId) continue
      const bucket = out.get(e.parentId) ?? []
      bucket.push(e)
      out.set(e.parentId, bucket)
    }
    return out
  }, [result.entities])

  const statsById = useMemo(() => {
    const out = new Map<string, PersonStat[]>()
    const wanted = [OVERALL_ID, ...result.entities.map((e) => e.id)]
    for (const id of wanted) out.set(id, statsFor(result.series, id, peopleKeys))
    return out
  }, [result.series, result.entities, peopleKeys])

  const metric = useMemo(() => {
    return (entityId: string) => {
      const stats = statsById.get(entityId) ?? []
      return order === 'difference' ? spread(stats) : maxAbsChange(stats)
    }
  }, [statsById, order])

  const orderedDimensions = useMemo(
    () => orderEntities(dimensions, metric, order),
    [dimensions, metric, order],
  )

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-4 px-5 py-2.5 border-b border-border">
        <span className="w-[180px] flex-none text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          Competency
        </span>
        <span className="flex-1 min-w-0 flex justify-between text-[11px] text-muted-foreground tabular-nums">
          <span>0</span>
          <span>typical range shaded</span>
          <span>100</span>
        </span>
        <span className="w-[200px] flex-none text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          Summary
        </span>
      </div>

      <Row
        name="Overall"
        emphasis
        stats={statsById.get(OVERALL_ID) ?? []}
        colourClasses={colourClasses}
        nameByPerson={nameByPerson}
        showChange={showChange}
        selected={charted === OVERALL_ID}
        onClick={() => onChart(OVERALL_ID)}
      />

      {orderedDimensions.map((dim) => {
        const open = openDimension === dim.id
        const factors = factorsByDimension.get(dim.id) ?? []
        return (
          <div key={dim.id}>
            <Row
              name={dim.name}
              emphasis
              chevron={factors.length > 0 ? (open ? 'open' : 'closed') : undefined}
              stats={statsById.get(dim.id) ?? []}
              colourClasses={colourClasses}
              nameByPerson={nameByPerson}
              showChange={showChange}
              selected={charted === dim.id}
              onClick={() => onChart(dim.id)}
            />
            {open &&
              orderEntities(factors, metric, order).map((factor) => (
                <Row
                  key={factor.id}
                  name={factor.name}
                  indent
                  stats={statsById.get(factor.id) ?? []}
                  colourClasses={colourClasses}
                  nameByPerson={nameByPerson}
                  showChange={showChange}
                  selected={charted === factor.id}
                  onClick={() => onChart(factor.id)}
                />
              ))}
          </div>
        )
      })}
    </div>
  )
}

function Row({
  name,
  stats,
  colourClasses,
  nameByPerson,
  showChange,
  selected,
  onClick,
  emphasis = false,
  indent = false,
  chevron,
}: {
  name: string
  stats: PersonStat[]
  colourClasses: string[]
  nameByPerson: Map<string, string>
  showChange: boolean
  selected: boolean
  onClick: () => void
  emphasis?: boolean
  indent?: boolean
  chevron?: 'open' | 'closed'
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'group relative flex w-full items-center gap-4 px-5 py-1.5 text-left',
        'border-b border-border/60 last:border-b-0 transition-colors',
        'hover:bg-[var(--cream)] dark:hover:bg-muted/40',
        'focus:outline-none focus-visible:bg-[var(--cream)] dark:focus-visible:bg-muted/40',
        selected && 'bg-[var(--cream)] dark:bg-muted/40',
        indent && 'bg-muted/20',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute inset-y-0 left-0 w-0.5 bg-[var(--gold)] origin-top transition-transform duration-200',
          selected ? 'scale-y-100' : 'scale-y-0 group-hover:scale-y-100',
        )}
      />
      <span
        className={cn(
          'w-[180px] flex-none flex items-center gap-1.5 truncate text-sm',
          emphasis ? 'font-semibold text-foreground' : 'text-muted-foreground',
          indent && 'pl-5',
        )}
      >
        {chevron && (
          <ChevronRight
            className={cn(
              'size-3.5 flex-none text-muted-foreground transition-transform duration-200',
              chevron === 'open' && 'rotate-90',
            )}
          />
        )}
        <span className="truncate">{name}</span>
      </span>
      <span className="flex-1 min-w-0">
        <CanvasRowTrack stats={stats} colourClasses={colourClasses} showChange={showChange} />
      </span>
      <span className="w-[200px] flex-none">
        <RowSummary
          stats={stats}
          colourClasses={colourClasses}
          nameByPerson={nameByPerson}
          showChange={showChange}
        />
      </span>
    </button>
  )
}

function DeltaChip({
  delta,
  significant,
}: {
  delta: number | null
  significant?: boolean | null
}) {
  if (delta === null) return null
  const muted = !isMeaningfulChange({ delta, significant: significant ?? null })
  return (
    <span
      className={cn(
        'tabular-nums',
        muted
          ? 'text-muted-foreground'
          : delta > 0
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-rose-500 dark:text-rose-400',
      )}
    >
      {formatSigned(delta)}
    </span>
  )
}

function RowSummary({
  stats,
  colourClasses,
  nameByPerson,
  showChange,
}: {
  stats: PersonStat[]
  colourClasses: string[]
  nameByPerson: Map<string, string>
  showChange: boolean
}) {
  const scored = stats.filter((s) => s.latest !== null)
  if (scored.length === 0) {
    return <span className="text-xs text-muted-foreground">Not measured yet</span>
  }

  if (stats.length <= 2) {
    return (
      <span className="flex flex-col gap-0.5">
        {stats.map((s, i) => (
          <span key={s.personKey} className="text-xs tabular-nums leading-tight">
            <span className={cn('font-semibold', colourClasses[i % colourClasses.length])}>
              {s.latest ?? '—'}
            </span>{' '}
            {showChange && <DeltaChip delta={s.delta} significant={s.significant} />}
          </span>
        ))}
      </span>
    )
  }

  const best = biggestChange(stats)
  const bestStat = best ? stats.find((s) => s.personKey === best.personKey) : undefined
  const bestIdx = best ? stats.findIndex((s) => s.personKey === best.personKey) : -1
  return (
    <span className="flex flex-col gap-0.5 text-xs leading-tight">
      <span className="text-muted-foreground">{rangeSentence(stats)}</span>
      {showChange && best && bestStat && isMeaningfulChange(bestStat) && (
        <span>
          <span className={cn('font-medium', colourClasses[bestIdx % colourClasses.length])}>
            {(nameByPerson.get(best.personKey) ?? '').split(' ')[0]}
          </span>{' '}
          <DeltaChip delta={best.delta} significant={bestStat.significant} />
        </span>
      )}
    </span>
  )
}
