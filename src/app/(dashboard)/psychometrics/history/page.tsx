import Link from 'next/link'
import { TrendingUp, Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { ScrollReveal } from '@/components/scroll-reveal'
import { listCalibrationRunsAction } from '@/app/actions/psychometrics'

export default async function HistoryPage() {
  const runs = await listCalibrationRunsAction()

  if (runs.length < 2) {
    return (
      <div className="space-y-8 max-w-4xl">
        <PageHeader
          eyebrow="Psychometrics"
          title="Calibration History"
          description="Track changes in item quality and scale reliability across calibration runs."
        />

        <EmptyState
          title="Not enough data for trend analysis"
          description="You need at least 2 calibration runs to compare trends. Run another calibration to see how metrics change over time."
        />
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <PageHeader
        eyebrow="Psychometrics"
        title="Calibration History"
        description="Track changes in item quality and scale reliability across calibration runs."
      />

      <ScrollReveal>
        <div className="space-y-3">
          {/* Deliberately not links: there is no per-run detail route, and a
              card that navigates to a 404 is worse than one that does not
              navigate at all. Run comparison lives on the Compare tab. */}
          {runs.map((run) => (
            <div key={run.id}>
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-competency-bg">
                        <Calendar className="size-5 text-competency-accent" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">
                          {run.label ||
                            new Date(run.createdAt).toLocaleDateString('en-AU', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {run.method} • {run.sampleSize} participants
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-6 text-right">
                      <div>
                        <p className="text-sm font-semibold tabular-nums">
                          {run.itemStatisticsCount}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Items
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold tabular-nums">
                          {run.constructReliabilityCount}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Constructs
                        </p>
                      </div>

                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </ScrollReveal>

      <ScrollReveal delay={60}>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="size-5 text-trait-accent" />
              <CardTitle>About this view</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              This history shows all completed calibration runs in chronological order. Click any run to explore how item quality, construct reliability, and flagged items changed across your data collection periods.
            </p>
            <p>
              To see trends for a specific construct across runs, visit the{' '}
              <Link href="/psychometrics/constructs" className="text-foreground font-medium underline">
                Construct Reliability
              </Link>{' '}
              page and select a construct.
            </p>
          </CardContent>
        </Card>
      </ScrollReveal>
    </div>
  )
}
