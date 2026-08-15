import Link from 'next/link'
import { Dna, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { ScrollReveal } from '@/components/scroll-reveal'
import { TiltCard } from '@/components/tilt-card'
import {
  AlphaDisplay,
  HorizontalBar,
  HealthBadge,
} from '@/components/psychometric-visuals'
import { getConstructStats } from '@/app/actions/psychometrics'
import { cn } from '@/lib/utils'

function alphaStatus(value: number | null): 'healthy' | 'review' | 'action' {
  if (value === null) return 'action'
  if (value >= 0.80) return 'healthy'
  if (value >= 0.70) return 'review'
  return 'action'
}

function alphaBorderClass(value: number | null): string {
  if (value === null) return 'border-l-muted-foreground/30'
  if (value >= 0.80) return 'border-l-emerald-500'
  if (value >= 0.70) return 'border-l-amber-500'
  return 'border-l-red-500'
}

export default async function ConstructsPage() {
  const constructs = await getConstructStats()

  if (constructs.length === 0) {
    return (
      <div className="space-y-8 max-w-6xl">
        <PageHeader
          eyebrow="Psychometrics"
          title="Construct Reliability"
          description="Internal consistency and measurement precision for each scale in your library."
        />

        <EmptyState
          variant="trait"
          title="No reliability data yet"
          description="Construct reliability metrics require calibration data. After collecting responses, run a calibration to see Cronbach's alpha, omega, and measurement error for each scale."
        />
      </div>
    )
  }

  const total = constructs.length
  const meetingThreshold = constructs.filter(
    (c) => c.cronbachAlpha !== null && c.cronbachAlpha >= 0.70,
  ).length
  const avgAlpha =
    total > 0
      ? constructs.reduce((sum, c) => sum + (c.cronbachAlpha ?? 0), 0) / total
      : 0

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        eyebrow="Psychometrics"
        title="Construct Reliability"
        description="Internal consistency and measurement precision for each scale in your library."
      />

      <ScrollReveal>
        <div className="grid grid-cols-3 gap-4">
          <Card variant="glass">
            <CardContent className="flex flex-col items-center py-4">
              <span className="text-3xl font-semibold tabular-nums text-trait-accent">
                {total}
              </span>
              <span className="text-xs text-muted-foreground mt-1">
                Constructs analysed
              </span>
            </CardContent>
          </Card>

          <Card variant="glass">
            <CardContent className="flex flex-col items-center py-4">
              <span className="text-3xl font-semibold tabular-nums text-emerald-600">
                {meetingThreshold}
              </span>
              <span className="text-xs text-muted-foreground mt-1">
                Meet threshold (≥ .70)
              </span>
            </CardContent>
          </Card>

          <Card variant="glass">
            <CardContent className="flex flex-col items-center py-4">
              <AlphaDisplay value={avgAlpha} label="Avg alpha" />
            </CardContent>
          </Card>
        </div>
      </ScrollReveal>

      <div className="grid gap-4 sm:grid-cols-2">
        {constructs.map((construct, index) => (
          <ScrollReveal key={construct.constructId} delay={index * 60}>
            <TiltCard>
              <Link href={`/psychometrics/constructs/${construct.constructId}`}>
                <Card
                  variant="interactive"
                  className={cn(
                    'border-l-[3px]',
                    alphaBorderClass(construct.cronbachAlpha),
                  )}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-trait-bg transition-all duration-300 group-hover/card:shadow-[0_0_20px_var(--glow-color)]"
                          style={
                            {
                              '--glow-color': 'var(--trait-accent)',
                            } as React.CSSProperties
                          }
                        >
                          <Dna className="size-5 text-trait-accent" />
                        </div>
                        <CardTitle className="text-title font-semibold">
                          {construct.constructName}
                        </CardTitle>
                      </div>
                      <HealthBadge
                        status={alphaStatus(construct.cronbachAlpha)}
                      />
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {construct.withheldReason ? (
                      <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3">
                        <Info className="size-4 mt-0.5 shrink-0 text-muted-foreground" />
                        <div className="text-xs text-muted-foreground">
                          {construct.withheldReason}
                        </div>
                      </div>
                    ) : (
                      <>
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

                        {construct.alphaConfidenceLower !== null &&
                          construct.alphaConfidenceUpper !== null && (
                            <div className="text-xs text-muted-foreground">
                              95% CI: [{construct.alphaConfidenceLower.toFixed(3)},
                              {construct.alphaConfidenceUpper.toFixed(3)}]
                            </div>
                          )}

                        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                          {construct.omegaTotal !== null && (
                            <div>
                              <p className="tabular-nums font-medium text-foreground">
                                {construct.omegaTotal.toFixed(2)}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Omega
                              </p>
                            </div>
                          )}

                          {construct.sem !== null && (
                            <div>
                              <p className="tabular-nums font-medium text-foreground">
                                {construct.sem.toFixed(3)}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                SEM
                              </p>
                            </div>
                          )}

                          {construct.itemCount !== null && (
                            <div>
                              <p className="tabular-nums font-medium text-foreground">
                                {construct.itemCount}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Items
                              </p>
                            </div>
                          )}

                          {construct.responseCount > 0 && (
                            <div>
                              <p className="tabular-nums font-medium text-foreground">
                                {construct.responseCount.toLocaleString()}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Responses
                              </p>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </Link>
            </TiltCard>
          </ScrollReveal>
        ))}
      </div>
    </div>
  )
}
