'use client'

// =============================================================================
// ChatScoreCard — a person's results, rendered from tool data.
//
// Composes the report layer's FactorRow rather than drawing its own bar, so a
// score can never be shown one way in chat and another way on the report page.
//
// The percentile is rendered only when the factor carries one, and a factor
// only carries one when its underlying row had a versioned norm group — the
// claims ladder makes the uncalibrated shape have no percentile field at all.
// The "no norm group" caveat is therefore a statement about the data, not a
// disclaimer bolted on by the UI.
// =============================================================================

import Link from 'next/link'
import { AlertTriangle, ExternalLink } from 'lucide-react'
import { FactorRow } from '@/components/reports/factor-row'
import { resolveBand } from '@/lib/reports/band-resolution'
import type { BandScheme, PaletteKey } from '@/lib/reports/band-scheme'
import { formatDateOrNull } from '@/lib/formatting'
import type { ScoreCardBlock } from '@/lib/chat/envelope'

export function ChatScoreCard({ block }: { block: ScoreCardBlock }) {
  const scheme: BandScheme = {
    palette: block.bandScheme.palette as PaletteKey,
    bands: block.bandScheme.bands.map((b) => ({
      ...b,
      indicatorTier: 'mid' as const,
    })),
  }
  const completed = formatDateOrNull(block.completedAt)

  return (
    <div className="rounded-lg border border-border bg-background/60 overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{block.participantName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {block.assessmentTitle ?? 'Assessment'}
            {completed ? ` · ${completed}` : ''}
          </p>
        </div>
        {block.href ? (
          <Link
            href={block.href}
            className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Full report
            <ExternalLink className="size-3" />
          </Link>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 px-3 py-3">
        {block.factors.map((factor) => (
          <div key={factor.factorId} className="flex flex-col gap-0.5">
            <FactorRow
              name={factor.name}
              pompScore={factor.scaledScore}
              bandResult={resolveBand(factor.scaledScore, scheme)}
              palette={scheme.palette}
              bands={scheme.bands}
              depth="glance"
              size="compact"
            />
            {(factor.percentile !== undefined || factor.provisional) && (
              <p className="text-[11px] text-muted-foreground">
                {factor.percentile !== undefined
                  ? `${factor.percentile}th percentile${
                      factor.normVersion ? ` · norms ${factor.normVersion}` : ''
                    }`
                  : null}
                {factor.percentile !== undefined && factor.provisional ? ' · ' : null}
                {factor.provisional ? 'Provisional' : null}
              </p>
            )}
          </div>
        ))}
      </div>

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
    </div>
  )
}
