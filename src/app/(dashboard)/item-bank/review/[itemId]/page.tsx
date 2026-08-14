/**
 * Item review screen (#347 scope items 2 and 3).
 *
 * The component boundary here is the security boundary:
 *
 *   - THIS FILE and `./item-preview.tsx` are server components. They hold the
 *     `ItemForReview` DTO, which carries the answer key and the per-distractor
 *     error labels, and they render it to HTML on the server.
 *   - `./review-panel.tsx` is the only client component, and it receives
 *     lifecycle and sign-off state only — never an option, never a key.
 *
 * Note this file must not NAME key material either: it is a `page.tsx`, and
 * `tests/architecture/admin-answer-key-isolation.test.ts` scans pages for the
 * key table and column identifiers. Reading `item.keyOptionId` off the DTO is
 * fine; writing the column name is not.
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertTriangle, ArrowLeft, FlaskConical } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { getItemForReview, getItemLifecycleTransitions } from '@/app/actions/item-bank'
import { DifficultyPriorNote, DifficultyPriorValue } from '../../difficulty-prior'
import { LifecycleBadge, StatTile } from '../../bank-stats'
import { formatDateTime } from '@/lib/formatting'
import { reviewerLabel } from '../../lifecycle-display'
import { ItemPreview } from './item-preview'
import { ABSENT_SIGN_OFF, ReviewPanel, type SignOffView } from './review-panel'

/** Server DTO -> the redacted view the client panel is allowed to see. */
function toSignOffView(signOff: {
  decision: 'approved' | 'rejected'
  reviewerName: string | null
  reviewerEmail: string | null
  reviewerProfileId: string
  reviewedAt: string
  matchesCurrentContent: boolean
  notes: string | null
} | null): SignOffView {
  if (!signOff) return ABSENT_SIGN_OFF
  return {
    present: true,
    approved: signOff.decision === 'approved',
    matchesCurrentContent: signOff.matchesCurrentContent,
    reviewer: reviewerLabel(signOff.reviewerName, signOff.reviewerEmail, signOff.reviewerProfileId),
    reviewedAt: signOff.reviewedAt,
    notes: signOff.notes,
  }
}

export default async function ItemReviewPage({
  params,
}: {
  params: Promise<{ itemId: string }>
}) {
  const { itemId } = await params

  const [item, transitionGraph] = await Promise.all([
    getItemForReview(itemId),
    getItemLifecycleTransitions(),
  ])
  if (!item) notFound()

  const legalTransitions = transitionGraph[item.lifecycleState] ?? []
  const failedGates = Object.entries(item.qaGates).filter(([, gate]) => gate.status === 'fail')

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <Link href="/item-bank/review">
          <Button variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground">
            <ArrowLeft className="size-4" />
            Review queue
          </Button>
        </Link>
        <PageHeader
          eyebrow={item.familyCode ?? 'Item'}
          title={item.stem}
          description={`Version ${item.itemVersion} · created ${formatDateTime(item.createdAt)}`}
        >
          <div className="flex items-center gap-2">
            <LifecycleBadge state={item.lifecycleState} />
            {item.familyId ? (
              <Link href={`/item-bank/families/${item.familyId}`}>
                <Button variant="outline" size="sm">
                  Family
                </Button>
              </Link>
            ) : null}
            {item.generationRunId ? (
              <Link href={`/item-bank/runs/${item.generationRunId}`}>
                <Button variant="outline" size="sm">
                  <FlaskConical className="size-4" />
                  Run
                </Button>
              </Link>
            ) : null}
          </div>
        </PageHeader>
      </div>

      {failedGates.length > 0 ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>
            {failedGates.length} QA gate{failedGates.length === 1 ? '' : 's'} failed for this item
          </AlertTitle>
          <AlertDescription>{failedGates.map(([gate]) => gate).join(', ')}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <ItemPreview
          gridSvg={item.gridSvg}
          ariaLabel={item.ariaLabel}
          options={item.options}
          keyRationale={item.keyRationale}
        />

        <aside className="space-y-4">
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-1">
            <StatTile label="Exposures" value={item.exposureCount.toLocaleString('en-AU')} />
            <StatTile label="Status" value={item.status} />
          </div>

          <div className="space-y-2 rounded-xl bg-card p-4 shadow-sm ring-1 ring-foreground/[0.06]">
            <p className="text-section font-medium">Difficulty prior</p>
            <DifficultyPriorValue
              value={item.difficultyPriorB}
              band={item.difficultyPriorBand}
              className="text-lg"
            />
            <p className="text-caption text-muted-foreground">
              Predicted before delivery. Not a measurement — see the note below.
            </p>
          </div>

          <div className="space-y-2 rounded-xl bg-card p-4 shadow-sm ring-1 ring-foreground/[0.06]">
            <p className="text-section font-medium">Provenance</p>
            <dl className="text-caption space-y-1">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Seed</dt>
                <dd className="truncate font-mono">{item.generatorSeed ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Content hash</dt>
                <dd className="truncate font-mono">{item.contentHash?.slice(0, 12) ?? '—'}</dd>
              </div>
            </dl>
          </div>

          {item.formPlacements.length > 0 ? (
            <div className="space-y-2 rounded-xl bg-card p-4 shadow-sm ring-1 ring-foreground/[0.06]">
              <p className="text-section font-medium">In forms</p>
              <ul className="text-caption space-y-1">
                {item.formPlacements.map((placement) => (
                  <li key={`${placement.assessmentId}-${placement.sectionId}`}>
                    {placement.assessmentTitle} · {placement.sectionTitle}{' '}
                    <Badge variant="secondary">{placement.sectionRole}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>

      <div className="space-y-3 rounded-xl bg-card p-4 shadow-sm ring-1 ring-foreground/[0.06]">
        <p className="text-section font-medium">Rules asserted by this item</p>
        {item.ruleStatements.length === 0 ? (
          <p className="text-caption text-muted-foreground">
            No rule statements are recorded — the stored spec is missing or no longer validates.
            Treat that as a review finding.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {item.ruleStatements.map((rule) => (
              <li key={rule.id} className="flex items-start gap-2 text-sm">
                <Badge variant="secondary" className="mt-0.5 shrink-0 font-mono text-[0.6875rem]">
                  {rule.id}
                </Badge>
                <span>
                  {rule.statement}{' '}
                  <span className="text-muted-foreground">
                    ({rule.axis}, {rule.direction})
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ReviewPanel
        itemId={item.itemId}
        lifecycleState={item.lifecycleState}
        contentSignOff={toSignOffView(item.contentSignOff)}
        fairnessSignOff={toSignOffView(item.fairnessSignOff)}
        legalTransitions={legalTransitions}
      />

      {item.reviewHistory.length > 0 ? (
        <div className="space-y-2 rounded-xl bg-card p-4 shadow-sm ring-1 ring-foreground/[0.06]">
          <p className="text-section font-medium">Review history</p>
          <p className="text-caption text-muted-foreground">
            Append-only. The newest entry per kind is the standing decision.
          </p>
          <ul className="divide-y divide-border/60">
            {item.reviewHistory.map((record, index) => (
              <li
                key={`${record.reviewKind}-${record.reviewedAt}-${index}`}
                className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-2 text-sm"
              >
                <Badge variant={record.decision === 'approved' ? 'default' : 'destructive'}>
                  {record.reviewKind} {record.decision}
                </Badge>
                <span>{record.reviewerName ?? record.reviewerProfileId}</span>
                <span className="text-caption text-muted-foreground">
                  {formatDateTime(record.reviewedAt)}
                </span>
                {record.notes ? (
                  <span className="text-caption w-full text-muted-foreground italic">
                    &ldquo;{record.notes}&rdquo;
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <DifficultyPriorNote />
    </div>
  )
}
