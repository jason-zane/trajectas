/**
 * Generation run detail — seed, generator version, QA gate pass/fail tallies,
 * rejection reasons, and the items the run put in the bank (#347 scope item 5).
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { EmptyState } from '@/components/empty-state'
import { getBankGenerationRun } from '@/app/actions/item-bank'
import { DifficultyPriorBandDistribution, DifficultyPriorNote } from '../../difficulty-prior'
import { StatTile } from '../../bank-stats'
import { ItemsTable } from '../../items-table'
import { toItemRow } from '../../to-item-row'
import { formatDateTime } from '@/lib/formatting'

export default async function GenerationRunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>
}) {
  const { runId } = await params
  const run = await getBankGenerationRun(runId)
  if (!run) notFound()

  const rows = run.items.map((item) => toItemRow(item))
  const gates = Object.entries(run.qaGateTallies)
  const rejections = Object.entries(run.rejectionReasons).sort((a, b) => b[1] - a[1])
  const perFamily = Object.entries(run.perFamily)
  const params_ = Object.entries(run.params)

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <Link href="/cognitive-items/runs">
          <Button variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground">
            <ArrowLeft className="size-4" />
            Generation runs
          </Button>
        </Link>
        <PageHeader
          eyebrow={run.kind}
          title={`${run.generatorName} ${run.generatorVersion}`}
          description={`Seed ${run.seed} · started ${formatDateTime(run.startedAt)}${
            run.requestedByName ? ` · requested by ${run.requestedByName}` : ''
          }`}
        >
          <Badge variant={run.status === 'failed' ? 'destructive' : 'secondary'}>{run.status}</Badge>
        </PageHeader>
      </div>

      {run.errorMessage ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>This run reported an error</AlertTitle>
          <AlertDescription>{run.errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Proposed" value={run.itemsProposed} />
        <StatTile label="Accepted" value={run.itemsAccepted} />
        <StatTile label="Rejected" value={run.itemsRejected} />
        <StatTile
          label="In bank"
          value={run.ingestedItemCount}
          hint="Specs pointing at this run"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-xl bg-card p-4 shadow-sm ring-1 ring-foreground/[0.06]">
          <p className="text-section font-medium">QA gates</p>
          {gates.length === 0 ? (
            <p className="text-caption text-muted-foreground">
              No gate tallies recorded for this run.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-caption text-left text-muted-foreground">
                  <th className="font-normal">Gate</th>
                  <th className="font-normal tabular-nums">Pass</th>
                  <th className="font-normal tabular-nums">Fail</th>
                  <th className="font-normal tabular-nums">Skip</th>
                </tr>
              </thead>
              <tbody>
                {gates.map(([gate, tally]) => (
                  <tr key={gate} className="border-t border-border/50">
                    <td className="py-1.5 font-mono text-[0.8125rem]">{gate}</td>
                    <td className="tabular-nums text-[var(--emerald-dark)]">{tally.pass ?? 0}</td>
                    <td
                      className={
                        (tally.fail ?? 0) > 0 ? 'tabular-nums text-destructive' : 'tabular-nums'
                      }
                    >
                      {tally.fail ?? 0}
                    </td>
                    <td className="tabular-nums text-muted-foreground">{tally.skip ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="space-y-3 rounded-xl bg-card p-4 shadow-sm ring-1 ring-foreground/[0.06]">
          <p className="text-section font-medium">Rejection reasons</p>
          {rejections.length === 0 ? (
            <p className="text-caption text-muted-foreground">
              Nothing was rejected, or the generator recorded no reasons.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {rejections.map(([reason, count]) => (
                <li key={reason} className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-mono text-[0.8125rem]">{reason}</span>
                  <span className="tabular-nums font-semibold">{count}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="pt-2">
            <DifficultyPriorBandDistribution counts={run.difficultyPriorBandDistribution} />
          </div>
        </div>
      </div>

      {perFamily.length > 0 ? (
        <div className="space-y-3 rounded-xl bg-card p-4 shadow-sm ring-1 ring-foreground/[0.06]">
          <p className="text-section font-medium">Per family</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-caption text-left text-muted-foreground">
                <th className="font-normal">Family</th>
                <th className="font-normal tabular-nums">Attempted</th>
                <th className="font-normal tabular-nums">Accepted</th>
                <th className="font-normal">Rejects</th>
              </tr>
            </thead>
            <tbody>
              {perFamily.map(([code, stats]) => (
                <tr key={code} className="border-t border-border/50">
                  <td className="py-1.5 font-mono text-[0.8125rem]">{code}</td>
                  <td className="tabular-nums">{stats.attempted}</td>
                  <td className="tabular-nums">{stats.accepted}</td>
                  <td className="text-caption text-muted-foreground">
                    {Object.entries(stats.rejects ?? {})
                      .map(([reason, count]) => `${reason} ${count}`)
                      .join(', ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {params_.length > 0 ? (
        <div className="space-y-2 rounded-xl bg-card p-4 shadow-sm ring-1 ring-foreground/[0.06]">
          <p className="text-section font-medium">Parameters</p>
          <p className="text-caption text-muted-foreground">
            With the seed above, these reproduce the run exactly.
          </p>
          <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            {params_.map(([key, value]) => (
              <div key={key} className="flex justify-between gap-2 text-sm">
                <dt className="text-muted-foreground">{key}</dt>
                <dd className="truncate font-mono text-[0.8125rem]">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </dd>
              </div>
            ))}
          </dl>
          {run.gitSha ? (
            <p className="text-caption pt-1 text-muted-foreground">
              Built at commit <span className="font-mono">{run.gitSha.slice(0, 12)}</span>
            </p>
          ) : null}
        </div>
      ) : null}

      <DifficultyPriorNote />

      {rows.length === 0 ? (
        <EmptyState
          variant="item"
          size="sm"
          title="No items from this run are in the bank"
          description="The run exists but no item specs point at it — either nothing was ingested, or the items were since deleted."
        />
      ) : (
        <ItemsTable items={rows} showFamily />
      )}
    </div>
  )
}
