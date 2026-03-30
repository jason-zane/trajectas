import Link from "next/link";
import { Plus, Wand2, ArrowRight, FileText, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ScrollReveal } from "@/components/scroll-reveal";
import { TiltCard } from "@/components/tilt-card";
import { getGenerationRuns } from "@/app/actions/generation";
import type { GenerationRunStatus } from "@/types/database";

type StatusMeta = {
  label: string;
  variant: "default" | "secondary" | "outline" | "destructive";
};

const statusMeta: Record<GenerationRunStatus, StatusMeta> = {
  configuring: { label: "In Progress", variant: "default" },
  generating: { label: "In Progress", variant: "default" },
  embedding: { label: "In Progress", variant: "default" },
  analysing: { label: "In Progress", variant: "default" },
  reviewing: { label: "Review Needed", variant: "secondary" },
  completed: { label: "Completed", variant: "outline" },
  failed: { label: "Failed", variant: "destructive" },
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function formatConstructTitle(names: string[]): string {
  if (names.length === 0) return "No constructs";
  if (names.length <= 3) return names.join(", ");
  return `${names.length} constructs`;
}

export default async function GeneratePage() {
  const runs = await getGenerationRuns();

  return (
    <div className="space-y-8 max-w-5xl">
      <PageHeader
        eyebrow="AI Tools"
        title="Item Generator"
        description="Generate psychometric items for your constructs using AI. Review and accept items into your library."
      >
        <Link href="/generate/new">
          <Button>
            <Plus className="size-4" />
            New Generation
          </Button>
        </Link>
      </PageHeader>

      {runs.length === 0 ? (
        <EmptyState
          title="No generation runs yet"
          description="Start your first AI generation run to produce psychometric items for your constructs."
          actionLabel="New Generation"
          actionHref="/generate/new"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {runs.map((run, index) => {
            const meta = statusMeta[run.status] ?? { label: run.status, variant: "secondary" as const };
            const title = formatConstructTitle(run.constructNames);

            return (
              <ScrollReveal key={run.id} delay={index * 60}>
                <TiltCard>
                  <Link href={`/generate/${run.id}`}>
                    <Card variant="interactive" className="border-l-[3px] border-l-primary">
                      <CardHeader>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-all duration-300 group-hover/card:shadow-[0_0_20px_var(--glow-color)]"
                              style={{ "--glow-color": "var(--primary)" } as React.CSSProperties}
                            >
                              <Wand2 className="size-5 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-sm font-semibold leading-snug line-clamp-1">
                                {title}
                              </CardTitle>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <Badge variant={meta.variant}>{meta.label}</Badge>
                                {run.nmiFinal !== undefined && run.nmiFinal !== null && (
                                  <span className="text-caption text-muted-foreground">
                                    NMI {run.nmiFinal.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover/card:opacity-100 transition-opacity mt-1 shrink-0" />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <FileText className="size-3.5" />
                            {run.itemsGenerated}{" "}
                            {run.itemsGenerated === 1 ? "item" : "items"} generated
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="size-3.5" />
                            {formatRelativeTime(run.created_at)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </TiltCard>
              </ScrollReveal>
            );
          })}
        </div>
      )}
    </div>
  );
}
