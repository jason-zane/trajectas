/**
 * Family detail — the family's rules, radicals and difficulty prior, plus
 * every item in it with lifecycle, sign-off state, exposure and form
 * placements (#347 scope item 4).
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { getBankFamilies, getFamilyItems } from '@/app/actions/item-bank'
import {
  DifficultyPriorBandDistribution,
  DifficultyPriorNote,
  DifficultyPriorValue,
} from '../../difficulty-prior'
import { LifecycleBreakdown, StatTile } from '../../bank-stats'
import { ItemsTable } from '../../items-table'
import { toItemRow } from '../../to-item-row'

export default async function FamilyDetailPage({
  params,
}: {
  params: Promise<{ familyId: string }>
}) {
  const { familyId } = await params

  // `getBankFamilies` is the only admin-scoped read that returns a family's
  // rules and radicals; there is no single-family action, so filter here rather
  // than adding a second data path.
  const families = await getBankFamilies()
  const family = families.find((candidate) => candidate.id === familyId)
  if (!family) notFound()

  const items = await getFamilyItems(familyId)
  const rows = items.map((item) => toItemRow(item, family.code))
  const radicals = family.radicals ? Object.entries(family.radicals) : []

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
          eyebrow={family.constructName ?? family.kind}
          title={family.code}
          description={family.notes ?? 'Item family. Members are clones sharing this rule set and radical profile.'}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Items" value={family.itemCount} />
        <StatTile
          label="Exposures"
          value={family.totalExposureCount.toLocaleString('en-AU')}
          hint="Across all members"
        />
        <StatTile label="Kind" value={family.kind} />
        <StatTile label="Rules" value={family.ruleIds.length || '—'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-xl bg-card p-4 shadow-sm ring-1 ring-foreground/[0.06]">
          <p className="text-section font-medium">Rules</p>
          {family.ruleIds.length === 0 ? (
            <p className="text-caption text-muted-foreground">No rule ids recorded on this family.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {family.ruleIds.map((rule) => (
                <Badge key={rule} variant="secondary" className="font-mono">
                  {rule}
                </Badge>
              ))}
            </div>
          )}

          <p className="text-section mt-4 font-medium">Radicals</p>
          {radicals.length === 0 ? (
            <p className="text-caption text-muted-foreground">
              No radical profile recorded — the difficulty prior below has no modelled inputs to explain it.
            </p>
          ) : (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {radicals.map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="text-caption truncate text-muted-foreground">{key}</dt>
                  <dd className="text-caption truncate font-mono tabular-nums">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <div className="space-y-4 rounded-xl bg-card p-4 shadow-sm ring-1 ring-foreground/[0.06]">
          <div className="space-y-1.5">
            <p className="text-section font-medium">Family difficulty prior</p>
            <DifficultyPriorValue
              value={family.difficultyPriorB}
              band={family.difficultyPriorBand}
              className="text-lg"
            />
          </div>
          <DifficultyPriorBandDistribution counts={family.difficultyPriorBandCounts} />
          <div className="space-y-2">
            <p className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Lifecycle
            </p>
            <LifecycleBreakdown
              counts={family.lifecycleCounts}
              emptyMessage="This family has no items."
            />
          </div>
        </div>
      </div>

      <DifficultyPriorNote />

      {rows.length === 0 ? (
        <EmptyState
          variant="item"
          size="sm"
          title="No items in this family"
          description="The family exists but no member items have been ingested against it."
        />
      ) : (
        <ItemsTable items={rows} />
      )}
    </div>
  )
}
