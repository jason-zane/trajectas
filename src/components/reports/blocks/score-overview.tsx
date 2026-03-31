import type { ScoreOverviewConfig, BandResult } from '@/lib/reports/types'

interface ScoreEntry {
  entityId: string
  entityName: string
  pompScore: number
  bandResult: BandResult
}

interface ScoreOverviewData {
  scores: ScoreEntry[]
  config: ScoreOverviewConfig
}

export function ScoreOverviewBlock({ data }: { data: Record<string, unknown> }) {
  const d = data as unknown as ScoreOverviewData
  if (!d.scores?.length) return null

  return (
    <div className="space-y-2">
      {d.scores.map((s) => (
        <ScoreBarRow key={s.entityId} entry={s} />
      ))}
    </div>
  )
}

function ScoreBarRow({ entry }: { entry: ScoreEntry }) {
  return (
    <div className="grid grid-cols-[200px_1fr_60px] items-center gap-4">
      <span className="text-sm font-medium truncate">{entry.entityName}</span>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${entry.pompScore}%` }}
        />
      </div>
      <span className="text-sm tabular-nums text-right text-muted-foreground">
        {Math.round(entry.pompScore)}
      </span>
    </div>
  )
}
