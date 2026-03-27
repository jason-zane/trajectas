import Link from "next/link";
import {
  Plus,
  ClipboardList,
  ArrowRight,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ScrollReveal } from "@/components/scroll-reveal";
import { getAssessments } from "@/app/actions/assessments";

const statusVariant: Record<string, "secondary" | "default" | "outline"> = {
  draft: "secondary",
  active: "default",
  archived: "outline",
};

const creationModeLabel: Record<string, string> = {
  manual: "Manual",
  ai_generated: "AI Generated",
  org_choice: "Org Choice",
};

export default async function AssessmentsPage() {
  const assessments = await getAssessments();

  return (
    <div className="space-y-8 max-w-5xl">
      <PageHeader
        eyebrow="Assessments"
        title="Assessments"
        description="Build and manage psychometric assessments from your factor library."
      >
        <Link href="/assessments/create">
          <Button>
            <Plus className="size-4" />
            Build Assessment
          </Button>
        </Link>
      </PageHeader>

      {assessments.length === 0 ? (
        <EmptyState
          title="No assessments yet"
          description="Create your first assessment by selecting factors and configuring scoring."
          actionLabel="Build Assessment"
          actionHref="/assessments/create"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {assessments.map((assessment, index) => (
            <ScrollReveal key={assessment.id} delay={index * 60}>
              <Link href={`/assessments/${assessment.id}/edit`}>
                <Card
                  variant="interactive"
                  className="border-l-[3px] border-l-primary"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-colors">
                          <ClipboardList className="size-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle>{assessment.title}</CardTitle>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge
                              variant={
                                statusVariant[assessment.status] ?? "secondary"
                              }
                            >
                              {assessment.status.charAt(0).toUpperCase() +
                                assessment.status.slice(1)}
                            </Badge>
                            <Badge variant="outline">
                              {creationModeLabel[assessment.creationMode] ??
                                assessment.creationMode}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover/card:opacity-100 transition-opacity mt-1" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    {assessment.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                        {assessment.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Layers className="size-3.5" />
                        {assessment.factorCount}{" "}
                        {assessment.factorCount === 1 ? "factor" : "factors"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </ScrollReveal>
          ))}
        </div>
      )}
    </div>
  );
}
