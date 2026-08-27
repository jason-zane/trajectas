'use client'

// =============================================================================
// ComparisonCard — people side by side on one instrument.
//
// Deliberately shows the band each score falls in rather than a rank position.
// A band is a criterion claim ("met this much of the standard"); a rank implies
// a population, and there isn't one until norms exist. The highest score in a
// pair is marked as leading ON THIS INSTRUMENT, which is a statement about the
// two people in front of you and nothing wider.
// =============================================================================

import { AlertTriangle } from 'lucide-react'
import { formatDateOrNull } from '@/lib/formatting'
import { resolveBand } from '@/lib/reports/band-resolution'
import { getBandChipColours } from '@/lib/reports/band-scheme'
import type { BandScheme, PaletteKey } from '@/lib/reports/band-scheme'
import { DestinationLinks } from './destination-links'
import type { ComparisonBlock } from '@/lib/chat/envelope'

export function ComparisonCard({ block }: { block: ComparisonBlock }) {
  const scheme: BandScheme = {
    palette: block.bandScheme.palette as PaletteKey,
    bands: block.bandScheme.bands.map((b) => ({ ...b, indicatorTier: 'mid' as const })),
  }

  const leaders = new Map<string, number>()
  for (const factor of block.factors) {
    let best = -Infinity
    for (const person of block.people) {
      const score = person.scores[factor.factorId]
      if (typeof score === 'number' && score > best) best = score
    }
    leaders.set(factor.factorId, best)
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background/60">
      <div className="border-b border-border px-3 py-2">
        <p className="text-sm font-semibold">
          {block.assessmentTitle ?? 'Comparison'}
        </p>
        <p className="text-xs text-muted-foreground">
          {block.people.length} people ·{' '}
          {block.sameCampaign ? 'same campaign' : 'different campaigns'}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th scope="col" className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Factor
              </th>
              {block.people.map((person) => (
                <th
                  key={person.name}
                  scope="col"
                  className="px-3 py-2 text-left text-[11px] font-medium"
                >
                  <span className="block truncate">{person.name}</span>
                  <span className="block truncate font-normal text-[10px] text-muted-foreground">
                    {formatDateOrNull(person.completedAt) ?? '—'}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.factors.map((factor) => (
              <tr key={factor.factorId} className="border-b border-border last:border-0">
                <th scope="row" className="px-3 py-2 text-left font-normal">
                  {factor.name}
                </th>
                {block.people.map((person) => {
                  const score = person.scores[factor.factorId]
                  if (typeof score !== 'number') {
                    return (
                      <td key={person.name} className="px-3 py-2 text-muted-foreground">
                        —
                      </td>
                    )
                  }
                  const band = resolveBand(score, scheme)
                  const chip = getBandChipColours(
                    scheme.palette,
                    band.bandIndex,
                    band.bandCount,
                  )
                  const leads = leaders.get(factor.factorId) === score
                  return (
                    <td key={person.name} className="px-3 py-2">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="rounded px-1.5 py-0.5 text-[11px] font-medium tabular-nums"
                          style={{ background: chip.bg, color: chip.text }}
                        >
                          {score}
                        </span>
                        <span className="truncate text-[11px] text-muted-foreground">
                          {band.bandLabel}
                        </span>
                        {leads && block.people.length > 1 ? (
                          <span className="text-[10px] font-medium text-primary">▲</span>
                        ) : null}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
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

      <DestinationLinks destinations={block.destinations} />
    </div>
  )
}
