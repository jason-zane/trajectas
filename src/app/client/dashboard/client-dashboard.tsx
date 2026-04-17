"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Megaphone,
  Search,
  Users,
} from "lucide-react";

import { FavoriteCampaignButton } from "@/components/campaigns/favorite-campaign-button";
import type {
  CampaignAssessmentOption,
  CampaignWithMeta,
  ClientRecentResult,
  OperationalClientCampaign,
} from "@/app/actions/campaigns";
import { CopyCampaignLinkButton } from "@/components/campaigns/copy-campaign-link-button";
import { LaunchCampaignButton } from "@/components/campaigns/launch-campaign-button";
import { AnimatedNumber } from "@/components/animated-number";
import { LocalTime } from "@/components/local-time";
import { PageHeader } from "@/components/page-header";
import { usePortal } from "@/components/portal-context";
import { ScrollReveal } from "@/components/scroll-reveal";
import { TiltCard } from "@/components/tilt-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const statusVariant: Record<
  string,
  "secondary" | "default" | "outline" | "destructive"
> = {
  draft: "secondary",
  active: "default",
  paused: "outline",
  closed: "destructive",
  archived: "outline",
};

const statusTopAccent: Record<string, string> = {
  active: "bg-primary",
  draft: "bg-muted-foreground/25",
  paused: "bg-amber-500",
  closed: "bg-destructive",
  archived: "bg-muted-foreground/25",
};

function getCompletionPercent(campaign: CampaignWithMeta) {
  if (campaign.participantCount === 0) {
    return 0;
  }

  return Math.round((campaign.completedCount / campaign.participantCount) * 100);
}

function getResultHref(result: ClientRecentResult) {
  if (result.latestSessionId) {
    return `/client/campaigns/${result.campaignId}/sessions/${result.latestSessionId}`;
  }

  return `/client/campaigns/${result.campaignId}/participants/${result.participantId}`;
}

interface ClientDashboardProps {
  campaigns: CampaignWithMeta[];
  operationalCampaigns: OperationalClientCampaign[];
  recentResults: ClientRecentResult[];
  launchAssessments: CampaignAssessmentOption[];
  clientId: string;
  favoriteCampaignIds?: string[];
}

export function ClientDashboard({
  campaigns,
  operationalCampaigns,
  recentResults,
  launchAssessments,
  clientId,
  favoriteCampaignIds = [],
}: ClientDashboardProps) {
  const { href } = usePortal();
  const favoriteSet = new Set(favoriteCampaignIds);

  // Sort operational campaigns: favorites first
  const sortedOperationalCampaigns = [...operationalCampaigns].sort((a, b) => {
    const aFav = favoriteSet.has(a.id) ? 0 : 1;
    const bFav = favoriteSet.has(b.id) ? 0 : 1;
    return aFav - bFav;
  });

  const totalParticipants = campaigns.reduce(
    (sum, campaign) => sum + campaign.participantCount,
    0,
  );
  const totalCompleted = campaigns.reduce(
    (sum, campaign) => sum + campaign.completedCount,
    0,
  );
  const activeCount = campaigns.filter((campaign) => campaign.status === "active").length;
  const totalAssessments = campaigns.reduce(
    (sum, campaign) => sum + campaign.assessmentCount,
    0,
  );

  return (
    <div className="space-y-10 max-w-6xl">
      <PageHeader
        eyebrow="Dashboard"
        title="Campaign operations"
        description="Launch quickly, send the right link, and jump straight into participant results."
      />

      {/* Stat cards — 4 across */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          { key: "active", label: "Active campaigns", value: activeCount, icon: Megaphone },
          { key: "assessments", label: "Assessments", value: totalAssessments, icon: ClipboardList },
          { key: "participants", label: "Participants", value: totalParticipants, icon: Users },
          { key: "completed", label: "Completed", value: totalCompleted, icon: CheckCircle2 },
        ].map((stat, index) => (
          <ScrollReveal key={stat.key} delay={index * 60}>
            <TiltCard className="h-full">
              <Card variant="interactive" className="h-full">
                <CardContent className="flex items-start justify-between pt-5">
                  <div>
                    <AnimatedNumber
                      value={stat.value}
                      className="text-3xl font-bold tabular-nums"
                    />
                    <p className="text-caption text-muted-foreground mt-1">
                      {stat.label}
                    </p>
                  </div>
                  <div
                    className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover/card:shadow-[0_0_20px_var(--glow-color)] transition-shadow duration-300"
                    style={{ "--glow-color": "var(--primary)" } as React.CSSProperties}
                  >
                    <stat.icon className="size-5" />
                  </div>
                </CardContent>
              </Card>
            </TiltCard>
          </ScrollReveal>
        ))}
      </div>

      {/* Action card — full width */}
      <ScrollReveal delay={0}>
        <Card>
          <CardContent className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2 md:max-w-sm">
              <p className="text-overline text-primary">What do you need to do?</p>
              <h2 className="text-title font-semibold tracking-tight">
                Start or continue a campaign in a few clicks.
              </h2>
              <p className="text-sm text-muted-foreground">
                Launch a campaign, copy the link, or jump straight into participant results.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 md:flex-col">
              <LaunchCampaignButton
                label="Launch campaign"
                assessments={launchAssessments}
                clients={[{ id: clientId, name: "My organisation" }]}
                recentCampaigns={campaigns}
                forcedClientId={clientId}
                successHrefPrefix="/client/campaigns"
              />
              <Link
                href={href("/participants?view=sessions")}
                className={buttonVariants({ variant: "outline" })}
              >
                <CheckCircle2 className="size-4" />
                View results
              </Link>
              <Link
                href={href("/participants")}
                className={buttonVariants({ variant: "outline" })}
              >
                <Search className="size-4" />
                Find participant
              </Link>
            </div>
          </CardContent>
        </Card>
      </ScrollReveal>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-title font-semibold tracking-tight">Active campaigns</h2>
            <p className="text-sm text-muted-foreground">
              Keep your top campaigns close, copy the link quickly, and jump back into participant activity.
            </p>
          </div>
          <Link
            href={href("/campaigns")}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            View all campaigns
            <ArrowRight className="size-4" />
          </Link>
        </div>

        {operationalCampaigns.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-sm text-muted-foreground">
                No campaigns yet. Launch your first campaign to start sending assessments.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 xl:grid-cols-3">
            {sortedOperationalCampaigns.map((campaign, index) => {
              const completion = getCompletionPercent(campaign);

              return (
                <ScrollReveal key={campaign.id} delay={index * 60}>
                  <TiltCard className="h-full">
                    <Card variant="interactive" className="h-full">
                      <div className={cn("absolute left-0 right-0 top-0 z-10 h-[3px] rounded-t-xl", statusTopAccent[campaign.status] ?? "bg-muted-foreground/25")} />
                      <CardHeader className="space-y-2">
                        <Link
                          href={href(`/campaigns/${campaign.id}`)}
                          className="inline-flex items-center gap-1 font-semibold leading-snug hover:text-primary"
                        >
                          {campaign.title}
                          <ArrowRight className="size-4 shrink-0" />
                        </Link>
                        <div className="flex items-center gap-2">
                          <Badge variant={statusVariant[campaign.status] ?? "secondary"}>
                            {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                          </Badge>
                          <FavoriteCampaignButton
                            campaignId={campaign.id}
                            isFavorite={favoriteSet.has(campaign.id)}
                          />
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>
                              {campaign.completedCount}/{campaign.participantCount || 0} completed
                            </span>
                            <span>{completion}%</span>
                          </div>
                          <Progress value={completion} className="gap-0" />
                        </div>

                        <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                          <CopyCampaignLinkButton
                            token={campaign.primaryAccessLink?.token}
                            createHref={href(
                              `/campaigns/${campaign.id}/participants?action=link`,
                            )}
                            variant={campaign.primaryAccessLink ? "default" : "outline"}
                          />
                          <Link
                            href={href(`/campaigns/${campaign.id}/participants?action=invite`)}
                            className={buttonVariants({ variant: "outline", size: "sm" })}
                          >
                            <Users className="size-4" />
                            Invite participants
                          </Link>
                          <Link
                            href={href(`/campaigns/${campaign.id}/participants?view=sessions`)}
                            className={buttonVariants({ variant: "outline", size: "sm" })}
                          >
                            <CheckCircle2 className="size-4" />
                            View results
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  </TiltCard>
                </ScrollReveal>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-title font-semibold tracking-tight">Recent results</h2>
            <p className="text-sm text-muted-foreground">
              Jump straight into the latest participant activity across your campaigns.
            </p>
          </div>
          <Link
            href={href("/participants?view=sessions")}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Open participants
            <ArrowRight className="size-4" />
          </Link>
        </div>

        <Card>
          <CardContent className="pt-4">
            {recentResults.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No results yet. Results will appear here once participants begin or complete an assessment.
              </div>
            ) : (
              <div className="space-y-2">
                {recentResults.map((result) => (
                  <div
                    key={`${result.participantId}-${result.latestSessionId ?? "none"}`}
                    className="flex flex-col gap-3 rounded-xl border border-border px-4 py-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="truncate font-medium">{result.participantName}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {result.campaignTitle} · {result.participantEmail}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <LocalTime iso={result.lastActivity} format="relative" />
                      </p>
                    </div>
                    <Link
                      href={getResultHref(result)}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      <CheckCircle2 className="size-4" />
                      Open results
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
