import { Sparkles, Building2, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ScrollReveal } from "@/components/scroll-reveal";
import { TiltCard } from "@/components/tilt-card";
import { getMatchingRuns } from "@/app/actions/matching";

const statusConfig: Record<string, { label: string; icon: typeof CheckCircle2; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending: { label: "Pending", icon: Clock, variant: "secondary" },
  running: { label: "Running", icon: Loader2, variant: "default" },
  completed: { label: "Completed", icon: CheckCircle2, variant: "outline" },
  failed: { label: "Failed", icon: XCircle, variant: "destructive" },
};

export default async function MatchingPage() {
  const runs = await getMatchingRuns();

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        title="AI Matching Engine"
        description="Use AI to match client diagnostic results with factor frameworks."
      />

      {runs.length === 0 ? (
        <EmptyState
          title="No matching runs yet"
          description="Complete a diagnostic session first, then run AI matching to generate factor-matched recommendations."
          actionLabel="View Diagnostics"
          actionHref="/diagnostics"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {runs.map((run, index) => {
            const status = statusConfig[run.status] ?? statusConfig.pending;
            const StatusIcon = status.icon;
            return (
              <ScrollReveal key={run.id} delay={index * 60}>
              <TiltCard>
              <Card
                variant="interactive"
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-all duration-300 group-hover/card:shadow-[0_0_20px_var(--glow-color)]"
                        style={{ "--glow-color": "var(--primary)" } as React.CSSProperties}
                      >
                        <Sparkles className="size-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-sm">{run.sessionTitle || "Matching Run"}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={status.variant}>
                            <StatusIcon className="size-3" />
                            {status.label}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Building2 className="size-3.5" />
                      <span>{run.clientName}</span>
                    </div>
                    {run.resultCount > 0 && (
                      <span>{run.resultCount} {run.resultCount === 1 ? "result" : "results"}</span>
                    )}
                  </div>
                  {run.errorMessage && (
                    <p className="text-xs text-destructive mt-2 line-clamp-2">
                      {run.errorMessage}
                    </p>
                  )}
                </CardContent>
              </Card>
              </TiltCard>
              </ScrollReveal>
            );
          })}
        </div>
      )}
    </div>
  );
}
