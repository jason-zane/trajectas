import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, ClipboardList, Clock3, Layers3, Target } from "lucide-react";

import { getClientAssessmentLibraryDetail } from "@/app/actions/client-entitlements";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/scroll-reveal";
import { resolveClientOrg } from "@/lib/auth/resolve-client-org";

function formatModeLabel(formatMode: "traditional" | "forced_choice") {
  return formatMode === "forced_choice" ? "Forced choice" : "Traditional";
}

function formatMinutes(minutes: number) {
  if (minutes <= 0) {
    return "Self-paced";
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}

function formatQuota(value: number | null) {
  return value === null ? "Unlimited" : value.toLocaleString("en-AU");
}

export default async function ClientAssessmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { clientId } = await resolveClientOrg("/client/assessments");
  if (!clientId) {
    redirect("/client/dashboard");
  }

  const { id } = await params;
  const assessment = await getClientAssessmentLibraryDetail(clientId, id);

  if (!assessment) {
    notFound();
  }

  const statCards = [
    {
      key: "duration",
      label: "Estimated duration",
      value: formatMinutes(assessment.estimatedDurationMinutes),
      icon: Clock3,
    },
    {
      key: "factors",
      label: "Factors",
      value: assessment.factorCount.toLocaleString("en-AU"),
      icon: Target,
    },
    {
      key: "sections",
      label: "Sections",
      value: assessment.sectionCount.toLocaleString("en-AU"),
      icon: Layers3,
    },
    {
      key: "quota",
      label: "Remaining quota",
      value: formatQuota(assessment.quotaRemaining),
      icon: ClipboardList,
    },
  ];

  return (
    <div className="max-w-6xl space-y-8">
      <PageHeader
        eyebrow="Assessments"
        title={assessment.title}
        description={
          assessment.description ??
          "Review the structure of this assessment before adding it to a campaign."
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/client/assessments">
            <Button variant="outline">
              <ArrowLeft className="size-4" />
              Back to assessments
            </Button>
          </Link>
          <Link href={`/client/campaigns/create?assessmentId=${encodeURIComponent(assessment.id)}`}>
            <Button>
              Use in a new campaign
              <ArrowRight className="size-4" />
            </Button>
          </Link>
        </div>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{formatModeLabel(assessment.formatMode)}</Badge>
        <Badge
          variant={
            assessment.status === "active"
              ? "default"
              : assessment.status === "draft"
                ? "secondary"
                : "outline"
          }
        >
          {assessment.status}
        </Badge>
        <Badge variant="secondary">
          {assessment.totalItemCount.toLocaleString("en-AU")} items
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card, index) => (
          <ScrollReveal key={card.key} delay={index * 60}>
            <Card className="h-full">
              <CardContent className="flex items-start justify-between gap-4 pt-5">
                <div>
                  <p className="text-caption text-muted-foreground">{card.label}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight">
                    {card.value}
                  </p>
                </div>
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <card.icon className="size-5" />
                </div>
              </CardContent>
            </Card>
          </ScrollReveal>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-title font-semibold tracking-tight">Sections</h2>
            <p className="text-sm text-muted-foreground">
              Read-only structure and pacing for the assessment experience.
            </p>
          </div>

          {assessment.sections.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-sm text-muted-foreground">
                This assessment does not have any published sections yet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {assessment.sections.map((section, index) => (
                <ScrollReveal key={section.id} delay={index * 50}>
                  <Card>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle>
                            {section.title || `Section ${section.displayOrder + 1}`}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {section.formatName}
                          </CardDescription>
                        </div>
                        <Badge variant="outline">
                          {section.itemCount} item{section.itemCount === 1 ? "" : "s"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {section.instructions ? (
                        <p className="text-sm text-muted-foreground">
                          {section.instructions}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{section.formatType}</Badge>
                        <Badge variant="secondary">
                          {section.itemsPerPage === null
                            ? "All items on one page"
                            : `${section.itemsPerPage} per page`}
                        </Badge>
                        {section.timeLimitSeconds ? (
                          <Badge variant="secondary">
                            {Math.ceil(section.timeLimitSeconds / 60)} min limit
                          </Badge>
                        ) : null}
                        <Badge variant="secondary">
                          {section.allowBackNav ? "Back navigation enabled" : "Forward only"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </ScrollReveal>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-title font-semibold tracking-tight">Factors</h2>
            <p className="text-sm text-muted-foreground">
              Competencies measured by this assessment.
            </p>
          </div>

          {assessment.factorsByDimension.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-sm text-muted-foreground">
                No factors are linked to this assessment yet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {assessment.factorsByDimension.map((group, index) => (
                <ScrollReveal
                  key={group.dimensionId ?? `ungrouped-${index}`}
                  delay={index * 50}
                >
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        {group.dimensionName ?? "Ungrouped factors"}
                      </CardTitle>
                      <CardDescription>
                        {group.factors.length} factor{group.factors.length === 1 ? "" : "s"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {group.factors.map((factor) => (
                        <div
                          key={factor.factorId}
                          className="rounded-lg border border-border/60 px-3 py-2"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-foreground">
                                {factor.factorName}
                              </p>
                              {factor.factorDescription ? (
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {factor.factorDescription}
                                </p>
                              ) : null}
                            </div>
                            <Badge variant="outline">
                              {factor.constructCount} construct
                              {factor.constructCount === 1 ? "" : "s"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </ScrollReveal>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
