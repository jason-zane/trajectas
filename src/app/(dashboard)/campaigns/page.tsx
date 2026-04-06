import Link from "next/link";
import {
  Plus,
  Megaphone,
  ArrowRight,
  Users,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ScrollReveal } from "@/components/scroll-reveal";
import { TiltCard } from "@/components/tilt-card";
import { getCampaigns } from "@/app/actions/campaigns";

const statusVariant: Record<string, "secondary" | "default" | "outline" | "destructive"> = {
  draft: "secondary",
  active: "default",
  paused: "outline",
  closed: "destructive",
  archived: "outline",
};

function formatDateRange(opensAt?: string, closesAt?: string) {
  if (!opensAt && !closesAt) return null;
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-AU", {
      month: "short",
      day: "numeric",
    });
  if (opensAt && closesAt) return `${fmt(opensAt)} – ${fmt(closesAt)}`;
  if (opensAt) return `Opens ${fmt(opensAt)}`;
  return `Closes ${fmt(closesAt!)}`;
}

export default async function CampaignsPage() {
  const campaigns = await getCampaigns();

  return (
    <div className="space-y-8 max-w-5xl">
      <PageHeader
        eyebrow="Campaigns"
        title="Campaigns"
        description="Deploy assessments to participants and track completion."
      >
        <Link href="/campaigns/create">
          <Button>
            <Plus className="size-4" />
            New Campaign
          </Button>
        </Link>
      </PageHeader>

      {campaigns.length === 0 ? (
        <EmptyState
          title="No campaigns yet"
          description="Create your first campaign to deploy assessments to participants."
          actionLabel="New Campaign"
          actionHref="/campaigns/create"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {campaigns.map((campaign, index) => {
            const completionPct =
              campaign.participantCount > 0
                ? Math.round(
                    (campaign.completedCount / campaign.participantCount) * 100,
                  )
                : 0;

            return (
              <ScrollReveal key={campaign.id} delay={index * 60}>
                <TiltCard>
                  <Link href={`/campaigns/${campaign.id}/overview`}>
                    <Card
                      variant="interactive"
                      className="border-l-[3px] border-l-primary"
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-all duration-300 group-hover/card:shadow-[0_0_20px_var(--glow-color)]"
                              style={
                                {
                                  "--glow-color": "var(--primary)",
                                } as React.CSSProperties
                              }
                            >
                              <Megaphone className="size-5 text-primary" />
                            </div>
                            <div>
                              <CardTitle>{campaign.title}</CardTitle>
                              <div className="mt-1 flex items-center gap-2 flex-wrap">
                                <Badge
                                  variant={
                                    statusVariant[campaign.status] ??
                                    "secondary"
                                  }
                                >
                                  {campaign.status.charAt(0).toUpperCase() +
                                    campaign.status.slice(1)}
                                </Badge>
                                {campaign.clientName && (
                                  <span className="text-caption">
                                    {campaign.clientName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover/card:opacity-100 transition-opacity mt-1" />
                        </div>
                      </CardHeader>
                      <CardContent>
                        {campaign.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                            {campaign.description}
                          </p>
                        )}

                        {/* Completion mini-bar */}
                        {campaign.participantCount > 0 && (
                          <div className="mb-3">
                            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                              <span>
                                {campaign.completedCount} /{" "}
                                {campaign.participantCount} completed
                              </span>
                              <span>{completionPct}%</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${completionPct}%` }}
                              />
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <ClipboardList className="size-3.5" />
                            {campaign.assessmentCount}{" "}
                            {campaign.assessmentCount === 1
                              ? "assessment"
                              : "assessments"}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Users className="size-3.5" />
                            {campaign.participantCount}{" "}
                            {campaign.participantCount === 1
                              ? "participant"
                              : "participants"}
                          </span>
                          {formatDateRange(
                            campaign.opensAt,
                            campaign.closesAt,
                          ) && (
                            <span className="text-caption">
                              {formatDateRange(
                                campaign.opensAt,
                                campaign.closesAt,
                              )}
                            </span>
                          )}
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
