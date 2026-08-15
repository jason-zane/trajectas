import Link from 'next/link'
import { ArrowLeft, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { ScrollReveal } from '@/components/scroll-reveal'
import { AlphaDisplay, HorizontalBar } from '@/components/psychometric-visuals'
import { Button } from '@/components/ui/button'
import { notFound } from 'next/navigation'
import {
  getConstructHistoricalTrends,
} from '@/app/actions/psychometrics'
import { createAdminClient } from '@/lib/supabase/admin'

interface ConstructDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function ConstructDetailPage(props: ConstructDetailPageProps) {
  const params = await props.params
  const { id: constructId } = params

  const db = createAdminClient()

  // Fetch construct detail from DAL
  const { getConstructDetail } = await import('@/lib/dal/calibration')
  const construct = await getConstructDetail(db, constructId)

  if (!construct) {
    notFound()
  }

  // Fetch historical trends
  const historicalTrends = await getConstructHistoricalTrends(constructId, 10)

  const n = construct.responseCount ?? 0

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/psychometrics/constructs">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4 mr-2" />
            Back
          </Button>
        </Link>
      </div>

      <PageHeader
        eyebrow="Psychometrics"
        title={construct.constructName}
        description="Detailed reliability analysis for this construct"
      />

      {n < 5 ? (
        <EmptyState
          title="Insufficient data"
          description={`This construct has only ${n} response${n !== 1 ? 's' : ''}. A minimum of 5 complete responses is required to compute reliability statistics.`}
        />
      ) : (
        <>
          <ScrollReveal>
            <Card>
              <CardHeader>
                <CardTitle>Reliability Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-end gap-4">
                  <AlphaDisplay
                    value={construct.cronbachAlpha}
                    label="Cronbach&apos;s alpha"
                  />
                </div>

                <HorizontalBar
                  value={construct.cronbachAlpha ?? 0}
                  label="Alpha"
                />

                <div className="grid grid-cols-2 gap-6">
                  {construct.omegaTotal !== null && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                        Omega (McDonald&apos;s)
                      </p>
                      <p className="text-2xl font-semibold tabular-nums">
                        {construct.omegaTotal.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        More accurate than alpha when items differ in strength
                      </p>
                    </div>
                  )}

                  {construct.splitHalf !== null && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                        Split-Half Reliability
                      </p>
                      <p className="text-2xl font-semibold tabular-nums">
                        {construct.splitHalf.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Spearman-Brown corrected
                      </p>
                    </div>
                  )}

                  {construct.sem !== null && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                        SEM
                      </p>
                      <p className="text-2xl font-semibold tabular-nums">
                        {construct.sem.toFixed(3)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Measurement error band
                      </p>
                    </div>
                  )}

                  {construct.itemCount !== null && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                        Item Count
                      </p>
                      <p className="text-2xl font-semibold tabular-nums">
                        {construct.itemCount}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Items in this construct
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-3 pt-4 border-t border-border">
                  <h3 className="text-sm font-semibold">Distribution</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {construct.mean !== null && (
                      <div>
                        <p className="text-muted-foreground text-xs mb-1">
                          Mean
                        </p>
                        <p className="font-medium tabular-nums">
                          {construct.mean.toFixed(2)}
                        </p>
                      </div>
                    )}
                    {construct.standardDeviation !== null && (
                      <div>
                        <p className="text-muted-foreground text-xs mb-1">
                          SD
                        </p>
                        <p className="font-medium tabular-nums">
                          {construct.standardDeviation.toFixed(2)}
                        </p>
                      </div>
                    )}
                    {construct.skewness !== null && (
                      <div>
                        <p className="text-muted-foreground text-xs mb-1">
                          Skewness
                        </p>
                        <p className="font-medium tabular-nums">
                          {construct.skewness.toFixed(2)}
                        </p>
                      </div>
                    )}
                    {construct.kurtosis !== null && (
                      <div>
                        <p className="text-muted-foreground text-xs mb-1">
                          Kurtosis
                        </p>
                        <p className="font-medium tabular-nums">
                          {construct.kurtosis.toFixed(2)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </ScrollReveal>

          {historicalTrends.length > 1 && (
            <ScrollReveal delay={60}>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="size-5 text-trait-accent" />
                    <CardTitle>Historical Trends</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {historicalTrends.map((trend) => (
                      <div
                        key={trend.runId}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {trend.runLabel ||
                              new Date(trend.runCreatedAt).toLocaleDateString(
                                'en-AU',
                              )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            n = {trend.responseCount}
                            {trend.withheldReason && ` — ${trend.withheldReason}`}
                          </p>
                        </div>
                        <div className="flex gap-6 text-right">
                          {trend.cronbachAlpha !== null && (
                            <div>
                              <p className="text-sm font-semibold tabular-nums">
                                {trend.cronbachAlpha.toFixed(2)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                α
                              </p>
                            </div>
                          )}
                          {trend.discrimination !== null && (
                            <div>
                              <p className="text-sm font-semibold tabular-nums">
                                {trend.discrimination.toFixed(2)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                disc
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>
          )}
        </>
      )}
    </div>
  )
}
