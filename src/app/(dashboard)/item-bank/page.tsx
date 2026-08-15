/**
 * Item bank overview — #347 scope item 4.
 *
 * Server component. Every read goes through `src/app/actions/item-bank.ts`,
 * which gates on `requireAdminScope()` before it opens a service-role client;
 * nothing on this page reads the database directly, and nothing on this page
 * touches key material.
 */

import Link from 'next/link'
import { ClipboardCheck, FlaskConical, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { getBankFamilies, getBankOverview } from '@/app/actions/item-bank'
import { DifficultyPriorBandDistribution, DifficultyPriorNote } from './difficulty-prior'
import { LifecycleBreakdown, StatTile } from './bank-stats'
import { FamiliesTable, type FamilyRow } from './families-table'
import { formatDate } from '@/lib/formatting'

export default async function ItemBankPage() {
  const [overview, families] = await Promise.all([getBankOverview(), getBankFamilies()])

  // Narrow the DTO to render-safe primitives before it crosses into the client
  // table. Nothing here is key material, but the same discipline keeps the
  // client payload to what the table actually draws.
  const rows: FamilyRow[] = families.map((family) => ({
    id: family.id,
    code: family.code,
    kind: family.kind,
    constructName: family.constructName,
    ruleIds: family.ruleIds,
    radicalCount: family.radicals ? Object.keys(family.radicals).length : 0,
    difficultyPriorB: family.difficultyPriorB,
    difficultyPriorBand: family.difficultyPriorBand,
    itemCount: family.itemCount,
    lifecycleCounts: family.lifecycleCounts,
    difficultyPriorBandCounts: family.difficultyPriorBandCounts,
    totalExposureCount: family.totalExposureCount,
  }))

  const reviewable = overview.lifecycleCounts.draft ?? 0

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        eyebrow="Library"
        title="Item Bank"
        description="Cognitive item families, their lifecycle state and their provenance. Every item must clear content and fairness review before it can enter service."
      >
        <div className="flex items-center gap-2">
          <Link href="/item-bank/generate">
            <Button variant="outline">
              <Sparkles className="size-4" />
              Generate items
            </Button>
          </Link>
          <Link href="/item-bank/runs">
            <Button variant="outline">
              <FlaskConical className="size-4" />
              Generation runs
            </Button>
          </Link>
          <Link href="/item-bank/review">
            <Button>
              <ClipboardCheck className="size-4" />
              Review queue
              {reviewable > 0 ? (
                <span className="ml-1 tabular-nums opacity-80">{reviewable}</span>
              ) : null}
            </Button>
          </Link>
        </div>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Families" value={overview.familyCount} />
        <StatTile label="Items" value={overview.itemCount} hint="Live items in a family" />
        <StatTile
          label="Exposures"
          value={overview.totalExposureCount.toLocaleString('en-AU')}
          hint="Times delivered to a candidate"
        />
        <StatTile
          label="Generation runs"
          value={overview.generationRunCount}
          hint={
            overview.latestGenerationRunAt
              ? `Latest ${formatDate(overview.latestGenerationRunAt)}`
              : 'None recorded'
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-xl bg-card p-4 shadow-sm ring-1 ring-foreground/[0.06]">
          <p className="text-section font-medium">Lifecycle</p>
          <LifecycleBreakdown
            counts={overview.lifecycleCounts}
            emptyMessage="No items have been ingested into the bank yet."
          />
        </div>
        <div className="space-y-3 rounded-xl bg-card p-4 shadow-sm ring-1 ring-foreground/[0.06]">
          <p className="text-section font-medium">Difficulty prior distribution</p>
          <DifficultyPriorBandDistribution counts={overview.difficultyPriorBandCounts} />
        </div>
      </div>

      <DifficultyPriorNote />

      {rows.length === 0 ? (
        <EmptyState
          variant="item"
          eyebrow="Item bank"
          title="No item families yet"
          description="Families appear here once a generated bank has been ingested. Ingest is idempotent by content hash, so re-running a bank cannot duplicate it."
          actionLabel="Generate items"
          actionHref="/item-bank/generate"
        />
      ) : (
        <FamiliesTable families={rows} />
      )}
    </div>
  )
}
