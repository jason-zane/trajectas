/**
 * Generation runs — #347 scope item 5: "a bank traceable to the parameters
 * that produced it".
 */

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { getBankGenerationRuns } from '@/app/actions/item-bank'
import { RunsTable, type RunRow } from './runs-table'

export default async function GenerationRunsPage() {
  const runs = await getBankGenerationRuns()

  const rows: RunRow[] = runs.map((run) => ({
    id: run.id,
    generator: `${run.generatorName} ${run.generatorVersion}`,
    kind: run.kind,
    seed: run.seed,
    status: run.status,
    itemsProposed: run.itemsProposed,
    itemsAccepted: run.itemsAccepted,
    itemsRejected: run.itemsRejected,
    ingestedItemCount: run.ingestedItemCount,
    requestedByName: run.requestedByName,
    startedAt: run.startedAt,
  }))

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <Link href="/cognitive-items">
          <Button variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground">
            <ArrowLeft className="size-4" />
            Item bank
          </Button>
        </Link>
        <PageHeader
          eyebrow="Provenance"
          title="Generation runs"
          description="Every ingested bank traces to the run that produced it — generator version, seed, QA gate tallies and the reasons items were rejected."
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          variant="item"
          title="No generation runs recorded"
          description="A run row is created when a generated bank is ingested. Re-ingesting an identical bank writes nothing, so runs appear only for banks that actually changed the database."
        />
      ) : (
        <RunsTable runs={rows} />
      )}
    </div>
  )
}
