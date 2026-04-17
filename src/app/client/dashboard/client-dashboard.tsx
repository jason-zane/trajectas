"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Megaphone,
  Search,
  Users,
} from "lucide-react";

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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

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
}

export function ClientDashboard({
  campaigns,
  operationalCampaigns,
  recentResults,
  launchAssessments,
  clientId,
}: ClientDashboardProps) {
  const { href } = usePortal();

  const totalParticipants = campaigns.reduce(
    (sum, campaign) => sum + campaign.participantCount,
    0,
  );
  const totalCompleted = campaigns.reduce(
    (sum, campaign) => sum + campaign.completedCount,
    0,
  );
  const activeCount = campaigns.filter((campaign) => campaign.status === "active").length;

  return (
    <div className="space-y-10 max-w-6xl">
      <PageHeader
        eyebrow="Dashboard"
        title="Campaign operations"
        description="Launch quickly, send the right link, and jump straight into participant results."
      />

      <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <ScrollReveal delay={0}>
          <Card>
            <CardContent className="space-y-5 pt-6">
              <div className="space-y-2">
                <p className="text-overline text-primary">What do you need to do?</p>
                <h2 className="text-title font-semibold tracking-tight">
                  Start or continue a campaign in a few clicks.
                </h2>
                <p className="text-sm text-muted-foreground">
                  The fastest path is to launch a campaign, copy the link, or jump
                  straight into participant results.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
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

        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          {[
            { key: "active", label: "Active campaigns", value: activeCount, icon: Megaphone },
            { key: "participants", label: "Participants", value: totalParticipants, icon: Users },
            { key: "completed", label: "Completed", value: totalCompleted, icon: CheckCircle2 },
          ].map((stat, index) => (
            <ScrollReveal key={stat.key} delay={(index + 1) * 60}>
              <Card>
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
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <stat.icon className="size-5" />
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>
          ))}
        </div>
      </section>

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
            {operationalCampaigns.map((campaign, index) => {
              const completion = getCompletionPercent(campaign);

              return (
                <ScrollReveal key={campaign.id} delay={index * 60}>
                  <Card className="h-full">
                    <CardHeader className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2">
                          <Link
                            href={href(`/campaigns/${campaign.id}`)}
                            className="inline-flex items-center gap-1 font-semibold hover:text-primary"
                          >
                            {campaign.title}
                            <ArrowRight className="size-4" />
                          </Link>
                          <Badge variant={statusVariant[campaign.status] ?? "secondary"}>
                            {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                          </Badge>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          {campaign.assessmentCount} assessment
                          {campaign.assessmentCount === 1 ? "" : "s"}
                        </div>
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
                          className="justify-start"
                        />
                        <Link
                          href={href(`/campaigns/${campaign.id}/participants?action=invite`)}
                          className={buttonVariants({ variant: "outline", size: "sm" })}
                        >
                          <Users className="size-4" />
                          Invite participants
                        </Link>
                        <Link
                          href={href(`/campaigns/${campaign.id}/participants`)}
                          className={buttonVariants({ variant: "outline", size: "sm" })}
                        >
                          <CheckCircle2 className="size-4" />
                          View results
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
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
