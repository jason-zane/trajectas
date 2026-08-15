import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { ScrollReveal } from '@/components/scroll-reveal'
import { Badge } from '@/components/ui/badge'
import { getLatestTwoRuns } from '@/app/actions/psychometrics'

export default async function ComparisonPage() {
  const runs = await getLatestTwoRuns()

  if (runs.length < 2) {
    return (
      <div className="space-y-8 max-w-4xl">
        <PageHeader
          eyebrow="Psychometrics"
          title="Run Comparison"
          description="Compare metrics between your latest two calibration runs."
        />

        <EmptyState
          title="Not enough calibration runs"
          description="You need at least 2 completed calibration runs to compare. Once you have collected additional data and run another calibration, you'll be able to see how metrics changed."
        />
      </div>
    )
  }

  const [run1, run2] = runs

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        eyebrow="Psychometrics"
        title="Run Comparison"
        description="Compare metrics between your latest two calibration runs."
      />

      <ScrollReveal>
        <div className="grid grid-cols-2 gap-6">
          {[run1, run2].map((run, idx) => (
            <Card key={run.runId} variant="glass">
              <CardHeader>
                <CardTitle className="text-base">
                  {run.runLabel ||
                    new Date(run.runCreatedAt).toLocaleDateString('en-AU', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {run.method} • {idx === 0 ? 'Newer' : 'Older'}
                </p>
              </CardHeader>

              <CardContent className="space-y-6">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                    Sample Size
                  </p>
                  <p className="text-3xl font-semibold tabular-nums">
                    {run.sampleSize?.toLocaleString() ?? '—'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Participants
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                      Constructs
                    </p>
                    <p className="text-2xl font-semibold tabular-nums">
                      {run.constructCount}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                      Items Analyzed
                    </p>
                    <p className="text-2xl font-semibold tabular-nums">
                      {run.itemsAnalyzed}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Flagged items</p>
                    <Badge
                      variant={
                        run.itemsFlagged === 0 ? 'default' : 'destructive'
                      }
                    >
                      {run.itemsFlagged}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollReveal>

      {run1 && run2 && (
        <ScrollReveal delay={60}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Key Changes</CardTitle>
            </CardHeader>

            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Sample Size</span>
                  <span className="font-medium tabular-nums">
                    {run1.sampleSize === null || run2.sampleSize === null
                      ? '—'
                      : run1.sampleSize - (run2.sampleSize || 0) > 0
                        ? `+${run1.sampleSize - (run2.sampleSize || 0)}`
                        : `${run1.sampleSize - (run2.sampleSize || 0)}`}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Constructs Analyzed</span>
                  <span className="font-medium tabular-nums">
                    {run1.constructCount - run2.constructCount > 0
                      ? `+${run1.constructCount - run2.constructCount}`
                      : `${run1.constructCount - run2.constructCount}`}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Items Analyzed</span>
                  <span className="font-medium tabular-nums">
                    {run1.itemsAnalyzed - run2.itemsAnalyzed > 0
                      ? `+${run1.itemsAnalyzed - run2.itemsAnalyzed}`
                      : `${run1.itemsAnalyzed - run2.itemsAnalyzed}`}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Flagged Items</span>
                  <span
                    className={`font-medium tabular-nums ${run1.itemsFlagged < run2.itemsFlagged ? 'text-emerald-600' : 'text-destructive'}`}
                  >
                    {run1.itemsFlagged - run2.itemsFlagged > 0
                      ? `+${run1.itemsFlagged - run2.itemsFlagged}`
                      : `${run1.itemsFlagged - run2.itemsFlagged}`}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </ScrollReveal>
      )}
    </div>
  )
}
