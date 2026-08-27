'use client'

// =============================================================================
// TimelineCard — a person's sittings over time.
//
// Change is rendered only where the DAL computed it, which is only ever within
// one instrument. The card does not draw a line between two sittings on
// different assessments, because that line would not mean anything.
// =============================================================================

import Link from 'next/link'
import { ArrowDownRight, ArrowRight, ArrowUpRight, AlertTriangle } from 'lucide-react'
import { formatDateOrNull } from '@/lib/formatting'
import { DestinationLinks } from './destination-links'
import type { TimelineBlock } from '@/lib/chat/envelope'

function Delta({ delta }: { delta: number }) {
  const Icon = delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : ArrowRight
  const tone =
    delta > 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : delta < 0
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-muted-foreground'
  return (
    <span className={`inline-flex items-center gap-0.5 tabular-nums ${tone}`}>
      <Icon className="size-3.5" />
      {delta > 0 ? '+' : ''}
      {delta}
    </span>
  )
}

export function TimelineCard({ block }: { block: TimelineBlock }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background/60">
      <div className="border-b border-border px-3 py-2">
        <p className="text-sm font-semibold">{block.personName}</p>
        <p className="text-xs text-muted-foreground">
          {block.sittings.length} completed{' '}
          {block.sittings.length === 1 ? 'sitting' : 'sittings'}
        </p>
      </div>

      <ol className="flex flex-col divide-y divide-border">
        {block.sittings.map((sitting) => (
          <li key={sitting.sessionId} className="flex items-baseline gap-3 px-3 py-2">
            <span className="w-24 shrink-0 font-mono text-[11px] text-muted-foreground">
              {formatDateOrNull(sitting.completedAt) ?? '—'}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">
                {sitting.assessmentTitle ?? 'Assessment'}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {sitting.campaignTitle ?? '—'}
                {sitting.factorCount > 0 ? ` · ${sitting.factorCount} factors` : ' · no scores'}
              </span>
            </span>
            {sitting.href ? (
              <Link
                href={sitting.href}
                className="shrink-0 text-[11px] font-medium text-primary hover:underline"
              >
                View
              </Link>
            ) : null}
          </li>
        ))}
      </ol>

      {block.changes.length > 0 && (
        <div className="border-t border-border">
          <p className="px-3 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Change, same assessment
          </p>
          <ul className="flex flex-col divide-y divide-border">
            {block.changes.map((change) => (
              <li
                key={`${change.assessmentTitle}-${change.factorName}`}
                className="flex items-baseline gap-3 px-3 py-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">{change.factorName}</span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                  {change.fromScore} → {change.toScore}
                </span>
                <span className="w-14 shrink-0 text-right text-xs font-medium">
                  <Delta delta={change.delta} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {block.caveats.length > 0 && (
        <div className="flex gap-2 border-t border-border bg-muted/40 px-3 py-2">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <ul className="flex flex-col gap-1 text-[11px] leading-relaxed text-muted-foreground">
            {block.caveats.map((caveat) => (
              <li key={caveat}>{caveat}</li>
            ))}
          </ul>
        </div>
      )}

      <DestinationLinks destinations={block.destinations} />
    </div>
  )
}
