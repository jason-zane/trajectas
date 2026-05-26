import type { TrajectorySummary } from '@/lib/trajectory/types'

/**
 * Editorial summary above the hero chart. Two-line lede in plain English;
 * the chart underneath is the proof. Designed to read like the opening of
 * the eventual personal trajectory report.
 */
export function TrajectorySummaryPanel({
  displayName,
  summary,
}: {
  displayName: string
  summary: TrajectorySummary
}) {
  if (summary.sessionCount === 0) return null

  const dateRange = formatRange(summary.earliestCompletedAt, summary.latestCompletedAt)
  const top = summary.topMovers.slice(0, 2)
  const stableCount = summary.stable.length

  const firstName = displayName.split(/\s+/)[0] || displayName

  return (
    <div className="space-y-2 px-1">
      <p className="text-overline text-[var(--gold)]">What changed</p>
      <p className="text-base leading-relaxed text-foreground">
        <span className="font-semibold">{firstName}</span>
        {' has completed '}
        <NumWord n={summary.sessionCount} suffix="session" />
        {summary.assessmentCount > 1 && (
          <>
            {' across '}
            <NumWord n={summary.assessmentCount} suffix="assessment" />
          </>
        )}
        {dateRange && (
          <>
            {' '}
            <span className="text-muted-foreground">({dateRange})</span>
          </>
        )}
        {'.'}
        {top.length > 0 ? (
          <>
            {' The biggest movements are '}
            {top.map((m, i) => (
              <span key={m.entityId}>
                {i > 0 && (i === top.length - 1 ? ' and ' : ', ')}
                <span className="font-semibold">{m.entityName}</span>{' '}
                <DeltaTag value={m.deltaScaled} />
              </span>
            ))}
            {'.'}
          </>
        ) : (
          <>
            {' All dimensions have held within the noise floor across these sessions.'}
          </>
        )}
        {stableCount > 0 && top.length > 0 && (
          <>
            {' '}
            <span className="text-muted-foreground">
              {stableCount === 1
                ? '1 other dimension has held steady.'
                : `${stableCount} other dimensions have held steady.`}
            </span>
          </>
        )}
      </p>
    </div>
  )
}

function NumWord({ n, suffix }: { n: number; suffix: string }) {
  return (
    <span className="tabular-nums font-semibold">
      {n}
      <span className="font-normal text-muted-foreground">
        {' '}
        {suffix}
        {n === 1 ? '' : 's'}
      </span>
    </span>
  )
}

function DeltaTag({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>
  const rounded = Math.round(value)
  // Direction is taken from the raw value so a small negative delta (e.g.
  // -0.4) that rounds to 0 still colours / signs correctly. When rounded
  // to exactly 0 we drop the sign and render a neutral tone — it's
  // effectively no change at the display precision.
  if (rounded === 0) {
    return <span className="tabular-nums font-semibold text-muted-foreground">0</span>
  }
  const positive = value > 0
  return (
    <span
      className={
        positive
          ? 'tabular-nums font-semibold text-emerald-700 dark:text-emerald-400'
          : 'tabular-nums font-semibold text-rose-700 dark:text-rose-400'
      }
    >
      {positive ? '+' : ''}{rounded}
    </span>
  )
}

function formatRange(fromIso: string | null, toIso: string | null): string | null {
  if (!fromIso || !toIso) return null
  const from = new Date(fromIso)
  const to = new Date(toIso)
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) return null
  const fromLabel = from.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
  const toLabel = to.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
  if (fromLabel === toLabel) return fromLabel
  return `${fromLabel} → ${toLabel}`
}
