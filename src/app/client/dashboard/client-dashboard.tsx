"use client";

import Link from "next/link";
import {
  Megaphone,
  Users,
  CheckCircle2,
  ClipboardList,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { ScrollReveal } from "@/components/scroll-reveal";
import { TiltCard } from "@/components/tilt-card";
import { AnimatedNumber } from "@/components/animated-number";
import { usePortal } from "@/components/portal-context";
import type { CampaignWithMeta } from "@/app/actions/campaigns";
import type { AssessmentAssignmentWithUsage } from "@/types/database";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Stat card config
// ---------------------------------------------------------------------------

interface StatConfig {
  key: string;
  label: string;
  icon: typeof Megaphone;
  getValue: (
    campaigns: CampaignWithMeta[],
    assignments: AssessmentAssignmentWithUsage[]
  ) => number;
  bgClass: string;
  iconClass: string;
  glowColor: string;
}

const stats: StatConfig[] = [
  {
    key: "active-campaigns",
    label: "Active Campaigns",
    icon: Megaphone,
    getValue: (campaigns) =>
      campaigns.filter((c) => c.status === "active").length,
    bgClass: "bg-primary/10",
    iconClass: "text-primary",
    glowColor: "var(--primary)",
  },
  {
    key: "total-participants",
    label: "Total Participants",
    icon: Users,
    getValue: (campaigns) =>
      campaigns.reduce((sum, c) => sum + c.participantCount, 0),
    bgClass: "bg-primary/10",
    iconClass: "text-primary",
    glowColor: "var(--primary)",
  },
  {
    key: "completed",
    label: "Completed",
    icon: CheckCircle2,
    getValue: (campaigns) =>
      campaigns.reduce((sum, c) => sum + c.completedCount, 0),
    bgClass: "bg-primary/10",
    iconClass: "text-primary",
    glowColor: "var(--primary)",
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ClientDashboardProps {
  campaigns: CampaignWithMeta[];
  assessmentAssignments: AssessmentAssignmentWithUsage[];
}

export function ClientDashboard({
  campaigns,
  assessmentAssignments,
}: ClientDashboardProps) {
  const { href } = usePortal();

  const activeCampaigns = campaigns.filter(
    (c) => c.status === "active" || c.status === "paused"
  );

  return (
    <div className="space-y-10 max-w-6xl">
      {/* Header */}
      <PageHeader
        eyebrow="Dashboard"
        title="Welcome back"
        description="Here's an overview of your campaigns and assessment usage."
      />

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat, index) => {
          const value = stat.getValue(campaigns, assessmentAssignments);
          return (
            <ScrollReveal key={stat.key} delay={index * 60}>
              <Card>
                <CardContent className="pt-5 pb-4 px-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <AnimatedNumber
                        value={value}
                        className="text-3xl font-bold tabular-nums"
                      />
                      <p className="text-caption text-muted-foreground mt-1">
                        {stat.label}
                      </p>
                    </div>
                    <div
                      className={`flex size-10 items-center justify-center rounded-xl ${stat.bgClass} transition-shadow duration-300`}
                    >
                      <stat.icon className={`size-5 ${stat.iconClass}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>
          );
        })}
      </div>

      {/* Active campaigns */}
      <section>
        <h2 className="text-title font-semibold tracking-tight mb-5">
          Active Campaigns
        </h2>

        {activeCampaigns.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Megaphone className="size-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No active campaigns at the moment.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {activeCampaigns.map((campaign, index) => {
              const completionPct =
                campaign.participantCount > 0
                  ? Math.round(
                      (campaign.completedCount / campaign.participantCount) * 100
                    )
                  : 0;

              return (
                <ScrollReveal key={campaign.id} delay={index * 60}>
                  <TiltCard>
                    <Link href={href(`/campaigns/${campaign.id}`)}>
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
                                </div>
                              </div>
                            </div>
                            <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover/card:opacity-100 transition-opacity mt-1" />
                          </div>
                        </CardHeader>
                        <CardContent>
                          {/* Completion progress */}
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
      </section>

      {/* Assessment usage table */}
      {assessmentAssignments.length > 0 && (
        <section>
          <h2 className="text-title font-semibold tracking-tight mb-5">
            Assessment Usage
          </h2>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Assessment</th>
                    <th className="px-5 py-3 font-medium text-right">Used</th>
                    <th className="px-5 py-3 font-medium text-right">
                      Remaining
                    </th>
                    <th className="px-5 py-3 font-medium w-32">Quota</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {assessmentAssignments.map((assignment) => {
                    const remaining =
                      assignment.quotaLimit !== null
                        ? Math.max(0, assignment.quotaLimit - assignment.quotaUsed)
                        : null;
                    const usagePct =
                      assignment.quotaLimit !== null && assignment.quotaLimit > 0
                        ? Math.round(
                            (assignment.quotaUsed / assignment.quotaLimit) * 100
                          )
                        : null;
                    const isLow =
                      remaining !== null &&
                      assignment.quotaLimit !== null &&
                      assignment.quotaLimit > 0 &&
                      remaining / assignment.quotaLimit <= 0.1;

                    return (
                      <tr key={assignment.id}>
                        <td className="px-5 py-3 font-medium">
                          {assignment.assessmentName}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {assignment.quotaUsed}
                        </td>
                        <td
                          className={`px-5 py-3 text-right tabular-nums ${
                            isLow
                              ? "text-amber-600 dark:text-amber-400 font-medium"
                              : ""
                          }`}
                        >
                          {remaining !== null ? remaining : (
                            <span className="text-muted-foreground">
                              Unlimited
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {usagePct !== null ? (
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-full rounded-full bg-muted">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    isLow
                                      ? "bg-amber-500 dark:bg-amber-400"
                                      : "bg-primary"
                                  }`}
                                  style={{ width: `${Math.min(usagePct, 100)}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground tabular-nums w-9 text-right shrink-0">
                                {usagePct}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              --
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}
