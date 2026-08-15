/**
 * Review queue — every item sitting in one lifecycle state (#347 scope item 3).
 *
 * The state filter is rendered as links rather than a client control so the
 * queue stays a plain server render: the selected state is in the URL, which
 * makes a queue shareable ("here are the 40 drafts waiting on you").
 */

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import type { ItemLifecycleState } from '@/lib/dal/item-bank-admin'
import { getBankOverview, getReviewQueue } from '@/app/actions/item-bank'
import { cn } from '@/lib/utils'
import { DifficultyPriorNote } from '../difficulty-prior'
import { ItemsTable } from '../items-table'
import { toItemRow } from '../to-item-row'
import { LIFECYCLE_ORDER, lifecycleDisplay } from '../lifecycle-display'

function resolveState(raw: string | string[] | undefined): ItemLifecycleState {
  const value = Array.isArray(raw) ? raw[0] : raw
  return (LIFECYCLE_ORDER as readonly string[]).includes(value ?? '')
    ? (value as ItemLifecycleState)
    : 'draft'
}

export default async function ReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const state = resolveState(params.state)

  const [overview, items] = await Promise.all([getBankOverview(), getReviewQueue(state)])
  const rows = items.map((item) => toItemRow(item))
  const display = lifecycleDisplay(state)

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <Link href="/item-bank">
          <Button variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground">
            <ArrowLeft className="size-4" />
            Item bank
          </Button>
        </Link>
        <PageHeader
          eyebrow="Review"
          title="Review queue"
          description="Content and fairness are separate judgements, recorded separately. An item needs both before it can enter piloting, calibration or live service."
        />
      </div>

      <nav aria-label="Lifecycle state" className="flex flex-wrap gap-1.5">
        {LIFECYCLE_ORDER.map((candidate) => {
          const count = overview.lifecycleCounts[candidate] ?? 0
          const isActive = candidate === state
          return (
            <Link
              key={candidate}
              href={`/item-bank/review?state=${candidate}`}
              aria-current={isActive ? 'page' : undefined}
              title={lifecycleDisplay(candidate).description}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-4xl px-3 py-1 text-sm font-medium transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-[var(--cream)] hover:text-foreground',
              )}
            >
              {lifecycleDisplay(candidate).label}
              <span className="tabular-nums opacity-75">{count}</span>
            </Link>
          )
        })}
      </nav>

      <p className="text-body text-muted-foreground">{display.description}</p>

      <DifficultyPriorNote />

      {rows.length === 0 ? (
        <EmptyState
          variant="item"
          size="sm"
          eyebrow={display.label}
          title={`Nothing in ${display.label.toLowerCase()}`}
          description="No items are currently in this lifecycle state."
        />
      ) : (
        <ItemsTable
          items={rows}
          showFamily
          emptyTitle="No items match"
          emptyDescription="Adjust the search to see more of the queue."
        />
      )}
    </div>
  )
}
