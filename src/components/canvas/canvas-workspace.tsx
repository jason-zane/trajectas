'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Plus, Table2, X } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { getComparisonCanvas } from '@/app/actions/canvas'
import { searchAllParticipants } from '@/app/actions/comparison'
import { AddParticipantDialog } from '@/components/comparison/add-participant-dialog'
import { PALETTE } from '@/components/trajectory/trajectory-timeline'
import { CanvasHero } from './canvas-hero'
import { CanvasBreakdown } from './canvas-breakdown'
import { monthYear } from '@/lib/canvas/summarize'
import {
  CANVAS_ORDERS,
  CANVAS_ORDER_LABEL,
  OVERALL_ID,
  type CanvasOrder,
  type CanvasResult,
} from '@/lib/canvas/types'
import { CANVAS_MAX_PEOPLE } from '@/lib/validations/canvas'

/**
 * The comparison canvas: hero chart on top, breakdown list below, three
 * controls (people, show change, order). Clicking a breakdown row charts
 * it; clicking a dimension also opens its factors. See the v4 spec.
 */

export function CanvasWorkspace({
  initial,
  initialCharted,
  initialOrder,
  initialShowChange,
  basePath,
  tableHref,
}: {
  initial: CanvasResult
  initialCharted?: string
  initialOrder?: CanvasOrder
  initialShowChange?: boolean
  basePath: string
  tableHref: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  const [result, setResult] = useState<CanvasResult>(initial)
  const [showChange, setShowChange] = useState(initialShowChange ?? true)
  const [order, setOrder] = useState<CanvasOrder>(initialOrder ?? 'standard')
  const [charted, setCharted] = useState<string>(initialCharted ?? OVERALL_ID)
  const [openDimension, setOpenDimension] = useState<string | null>(() => {
    const c = initialCharted ?? OVERALL_ID
    const entity = initial.entities.find((e) => e.id === c)
    if (!entity) return null
    return entity.level === 'dimension' ? entity.id : entity.parentId
  })
  const [showAdd, setShowAdd] = useState(false)

  const peopleKeys = useMemo(() => result.people.map((p) => p.personKey), [result.people])
  const nameByPerson = useMemo(
    () => new Map(result.people.map((p) => [p.personKey, p.displayName])),
    [result.people],
  )
  const colourClasses = useMemo(
    () => result.people.map((_, i) => PALETTE[i % PALETTE.length]),
    [result.people],
  )
  const entityById = useMemo(
    () => new Map(result.entities.map((e) => [e.id, e])),
    [result.entities],
  )
  const chartedName = charted === OVERALL_ID ? 'Overall' : entityById.get(charted)?.name ?? 'Overall'
  const sinceLabel = monthYear(
    result.people.reduce<string | null>(
      (acc, p) =>
        p.firstCompletedAt && (!acc || p.firstCompletedAt < acc) ? p.firstCompletedAt : acc,
      null,
    ),
  )

  // Mirror state to the URL so any canvas is shareable. `ids` is the
  // selection; chart/order/change only appear when they differ from the
  // defaults, keeping common URLs clean.
  const lastUrl = useRef('')
  useEffect(() => {
    const next = new URLSearchParams(params)
    next.set('ids', result.people.map((p) => p.entryCpId).join(','))
    if (charted !== OVERALL_ID) next.set('chart', charted)
    else next.delete('chart')
    if (order !== 'standard') next.set('order', order)
    else next.delete('order')
    if (!showChange) next.set('change', '0')
    else next.delete('change')
    const url = `${pathname}?${next.toString()}`
    if (url !== lastUrl.current) {
      lastUrl.current = url
      router.replace(url, { scroll: false })
    }
    // `params` is intentionally not a dep — replacing the URL refreshes it,
    // which would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.people, charted, order, showChange, pathname, router])

  function refetch(cpIds: string[]) {
    startTransition(async () => {
      const next = await getComparisonCanvas(cpIds)
      setResult(next)
    })
  }

  function addPeople(cpIds: string[]) {
    const current = result.people.map((p) => p.entryCpId)
    const merged = [...current, ...cpIds.filter((id) => !current.includes(id))]
    if (merged.length === current.length) return
    refetch(merged.slice(0, CANVAS_MAX_PEOPLE))
  }

  function removePerson(personKey: string) {
    const remaining = result.people.filter((p) => p.personKey !== personKey)
    if (remaining.length === 0) {
      router.push(basePath)
      return
    }
    refetch(remaining.map((p) => p.entryCpId))
  }

  function onChart(entityId: string) {
    const entity = entityById.get(entityId)
    if (entity?.level === 'dimension') {
      if (charted === entityId && openDimension === entityId) {
        setOpenDimension(null)
        return
      }
      setCharted(entityId)
      setOpenDimension(entityId)
      return
    }
    setCharted(entityId)
    if (entity?.level === 'factor' && entity.parentId) setOpenDimension(entity.parentId)
  }

  return (
    <div className="space-y-4 min-w-0 px-4">
      {/* People chips */}
      <div className="flex flex-wrap items-center gap-2">
        {result.people.map((person, i) => (
          <span
            key={person.personKey}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium"
          >
            <span
              aria-hidden
              className={cn('size-2.5 rounded-full bg-current', colourClasses[i])}
            />
            {person.displayName}
            <button
              type="button"
              aria-label={`Remove ${person.displayName}`}
              onClick={() => removePerson(person.personKey)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="size-3.5" />
            </button>
          </span>
        ))}
        {result.people.length < CANVAS_MAX_PEOPLE && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            <Plus className="size-3.5" />
            Add person
          </button>
        )}
      </div>

      {/* Controls: show change · order · table view */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Switch checked={showChange} onCheckedChange={setShowChange} />
          <div className="leading-tight">
            <p className="text-sm font-medium">Show change</p>
            <p className="text-xs text-muted-foreground">
              {sinceLabel ? `since first assessment · ${sinceLabel}` : 'since first assessment'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={order} onValueChange={(v) => setOrder(v as CanvasOrder)}>
            <SelectTrigger size="sm" aria-label="Order rows">
              <SelectValue>
                {(value: string | null) =>
                  CANVAS_ORDER_LABEL[(value as CanvasOrder) ?? 'standard']
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CANVAS_ORDERS.map((o) => (
                <SelectItem key={o} value={o}>
                  {CANVAS_ORDER_LABEL[o]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Link href={tableHref} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <Table2 className="size-4" />
            Table view
          </Link>
        </div>
      </div>

      {pending && <p className="text-xs text-muted-foreground">Updating…</p>}

      <CanvasHero
        result={result}
        charted={charted}
        chartedName={chartedName}
        peopleKeys={peopleKeys}
        nameByPerson={nameByPerson}
      />

      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-base font-semibold tracking-tight">Breakdown</h2>
        <p className="text-xs text-muted-foreground">
          Click any row to chart it · click a dimension to open its factors
        </p>
      </div>

      <CanvasBreakdown
        result={result}
        peopleKeys={peopleKeys}
        colourClasses={colourClasses}
        nameByPerson={nameByPerson}
        showChange={showChange}
        order={order}
        charted={charted}
        openDimension={openDimension}
        onChart={onChart}
      />

      {showAdd && (
        <AddParticipantDialog
          open
          onClose={() => setShowAdd(false)}
          onAdd={(opts) => addPeople(opts.map((o) => o.id))}
          searchSource={(query) => searchAllParticipants(query)}
        />
      )}
    </div>
  )
}
