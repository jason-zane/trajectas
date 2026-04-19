import { Dna, Info, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { ScrollReveal } from "@/components/scroll-reveal"
import {
  AlphaDisplay,
  HorizontalBar,
  HealthBadge,
} from "@/components/psychometric-visuals"
import { getConstructReliability } from "@/app/actions/psychometrics"
import { cn } from "@/lib/utils"

function alphaStatus(value: number | null): "healthy" | "review" | "action" {
  if (value === null) return "action"
  if (value >= 0.80) return "healthy"
  if (value >= 0.70) return "review"
  return "action"
}

function alphaBorderClass(value: number | null): string {
  if (value === null) return "border-l-muted-foreground/30"
  if (value >= 0.80) return "border-l-emerald-500"
  if (value >= 0.70) return "border-l-amber-500"
  return "border-l-red-500"
}

export default async function ReliabilityPage() {
  const data = await getConstructReliability()

  // Summary stats
  const total = data.length
  const meetingThreshold = data.filter(
    (c) => c.cronbachAlpha !== null && c.cronbachAlpha >= 0.70,
  ).length
  const avgAlpha =
    total > 0
      ? data.reduce((sum, c) => sum + (c.cronbachAlpha ?? 0), 0) / total
      : 0

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        eyebrow="Psychometrics"
        title="Scale Reliability"
        description="Internal consistency and measurement precision for each construct in your library."
      />

      {data.length === 0 ? (
        <EmptyState
          variant="trait"
          title="No reliability data yet"
          description="Construct reliability metrics require calibration data. After collecting responses, run a calibration to see Cronbach's alpha, omega, and measurement error for each scale."
        />
      ) : (
        <>
          {/* ---- Summary strip ---- */}
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
                    Meet threshold (&ge; .70)
                  </span>
                </CardContent>
              </Card>

              <Card variant="glass">
                <CardContent className="flex flex-col items-center py-4">
                  <AlphaDisplay value={avgAlpha} label="Avg alpha" size="sm" />
                </CardContent>
              </Card>
            </div>
          </ScrollReveal>

          {/* ---- Construct cards ---- */}
          <div className="grid gap-4 sm:grid-cols-2">
            {data.map((construct, index) => (
              <ScrollReveal key={construct.constructId} delay={index * 60}>
                <Card
                  variant="interactive"
                  className={cn(
                    "border-l-[3px]",
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
                              "--glow-color": "var(--trait-accent)",
                            } as React.CSSProperties
                          }
                        >
                          <Dna className="size-5 text-trait-accent" />
                        </div>
                        <CardTitle className="text-title font-semibold">
                          {construct.constructName}
                        </CardTitle>
                      </div>
                      <HealthBadge status={alphaStatus(construct.cronbachAlpha)} />
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Hero alpha */}
                    <div className="flex items-end gap-4">
                      <AlphaDisplay value={construct.cronbachAlpha} label="Cronbach's alpha" />
                    </div>

                    {/* Bar */}
                    <HorizontalBar
                      value={construct.cronbachAlpha ?? 0}
                      label="Alpha"
                    />

                    {/* Supporting metrics */}
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

                      {construct.responseCount !== null && (
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

                    {/* Explanatory labels */}
                    <div className="space-y-1.5 pt-2 border-t border-border">
                      <div className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Info className="size-3 mt-0.5 shrink-0" />
                        <span>
                          Alpha: Internal consistency — how well items measure
                          the same construct
                        </span>
                      </div>
                      {construct.sem !== null && (
                        <div className="flex items-start gap-2 text-xs text-muted-foreground">
                          <TrendingUp className="size-3 mt-0.5 shrink-0" />
                          <span>
                            SEM: Measurement error band — lower is more precise
                          </span>
                        </div>
                      )}
                      {construct.omegaTotal !== null && (
                        <div className="flex items-start gap-2 text-xs text-muted-foreground">
                          <Info className="size-3 mt-0.5 shrink-0" />
                          <span>
                            Omega: More accurate than alpha when items differ in
                            strength
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </ScrollReveal>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
