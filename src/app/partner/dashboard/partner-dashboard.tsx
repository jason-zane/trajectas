"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Building2, CalendarDays, Star } from "lucide-react";

import type {
  CampaignAssessmentOption,
  CampaignWithMeta,
  CompletionTimelinePoint,
} from "@/app/actions/campaigns";
import type { ClientWithCounts } from "@/app/actions/clients";
import type { PartnerRecentResult } from "@/lib/dal/partner-dashboard-mappers";
import { EmptyState } from "@/components/empty-state";
import { FavoriteCampaignButton } from "@/components/campaigns/favorite-campaign-button";
import { LaunchCampaignButton } from "@/components/campaigns/launch-campaign-button";
import { LocalTime } from "@/components/local-time";
import { RefreshOnFocus } from "@/components/refresh-on-focus";
import { Sparkline } from "@/components/sparkline";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

interface PartnerDashboardProps {
  clients: ClientWithCounts[];
  campaigns: CampaignWithMeta[];
  launchAssessments: CampaignAssessmentOption[];
  recentResults: PartnerRecentResult[];
  favoriteCampaignIds?: string[];
  completionTimeline?: CompletionTimelinePoint[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatWeekRange(now: Date): string {
  const dow = (now.getDay() + 6) % 7; // Monday = 0
  const monday = new Date(now);
  monday.setDate(now.getDate() - dow);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  return `${fmt(monday)} – ${fmt(sunday)}`;
}

function daysUntil(iso: string | undefined | null): number | null {
  if (!iso) return null;
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return null;
  return Math.ceil((target - Date.now()) / (1000 * 60 * 60 * 24));
}

function describeDeadline(days: number): string {
  if (days < 0) return "closed";
  if (days === 0) return "closes today";
  if (days === 1) return "closes tomorrow";
  return `closes in ${days} days`;
}

function CompletionRing({ value, size = 44 }: { value: number; size?: number }) {
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, value));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" aria-hidden>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.12}
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 600ms var(--ease-spring)" }}
      />
    </svg>
  );
}

// The design system has no `warning` Badge variant; gold is its warning accent
// (docs/ui-standards.md — "Colour Usage").
const WARNING_BADGE =
  "border-[var(--gold)]/40 bg-[var(--gold)]/15 text-[var(--emerald-dark)]";

function StatusDot({ status }: { status: string }) {
  const color =
    status === "active"
      ? "bg-[var(--emerald)]"
      : status === "paused"
        ? "bg-[var(--gold)]"
        : status === "closed"
          ? "bg-destructive"
          : "bg-muted-foreground/40";
  return <span className={cn("inline-block size-1.5 rounded-full", color)} aria-hidden />;
}

function SectionHeading({
  eyebrow,
  title,
  href,
  linkLabel,
}: {
  eyebrow: string;
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">
          {eyebrow}
        </p>
        <h2 className="mt-2 font-sans text-2xl font-bold tracking-[-0.02em] text-foreground">
          {title}
        </h2>
      </div>
      {href && linkLabel && (
        <Link href={href} className={buttonVariants({ variant: "ghost", size: "sm" })}>
          {linkLabel}
          <ArrowRight className="size-4" />
        </Link>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PartnerDashboard({
  clients,
  campaigns,
  launchAssessments,
  recentResults,
  favoriteCampaignIds = [],
  completionTimeline = [],
}: PartnerDashboardProps) {
  const favoriteSet = useMemo(() => new Set(favoriteCampaignIds), [favoriteCampaignIds]);
  const weekRange = useMemo(() => formatWeekRange(new Date()), []);

  const activeCampaigns = campaigns.filter((c) => c.status === "active");
  const activeCount = activeCampaigns.length;
  // Headline counts only active campaigns: a weekly "what's moving" view
  // shouldn't be skewed by draft, paused or closed work.
  const totalParticipants = activeCampaigns.reduce((sum, c) => sum + c.participantCount, 0);
  const totalCompleted = activeCampaigns.reduce((sum, c) => sum + c.completedCount, 0);
  const stillPending = Math.max(0, totalParticipants - totalCompleted);

  const closingSoon = campaigns.filter((c) => {
    if (c.status !== "active") return false;
    const d = daysUntil(c.closesAt);
    return d != null && d >= 0 && d <= 7;
  });

  // Keyed by id, not name: only the slug is unique, so two clients sharing a
  // display name would otherwise collapse into one.
  const clientsWithActive = useMemo(() => {
    const ids = new Set(activeCampaigns.map((c) => c.clientId).filter(Boolean));
    return ids.size;
  }, [activeCampaigns]);

  // Favourites first, then closing soonest — the same ranking the client
  // dashboard uses, applied across every client in the portfolio.
  const rankedCampaigns = useMemo(() => {
    const list = campaigns.filter((c) => c.status === "active");
    list.sort((a, b) => {
      const aFav = favoriteSet.has(a.id) ? 0 : 1;
      const bFav = favoriteSet.has(b.id) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;
      const aDays = daysUntil(a.closesAt) ?? Number.POSITIVE_INFINITY;
      const bDays = daysUntil(b.closesAt) ?? Number.POSITIVE_INFINITY;
      const aUrgent = aDays >= 0 && aDays <= 7 ? 0 : 1;
      const bUrgent = bDays >= 0 && bDays <= 7 ? 0 : 1;
      if (aUrgent !== bUrgent) return aUrgent - bUrgent;
      return aDays - bDays;
    });
    return list.slice(0, 3);
  }, [campaigns, favoriteSet]);

  const leadCampaign = rankedCampaigns[0];
  const leadDays = leadCampaign ? daysUntil(leadCampaign.closesAt) : null;
  const leadPct =
    leadCampaign && leadCampaign.participantCount > 0
      ? Math.round((leadCampaign.completedCount / leadCampaign.participantCount) * 100)
      : 0;
  const leadPending = leadCampaign
    ? Math.max(0, leadCampaign.participantCount - leadCampaign.completedCount)
    : 0;

  // Where attention goes next: clients with no campaign at all, then with
  // nothing assigned, then the rest.
  const clientsNeedingAttention = useMemo(() => {
    const campaignCountByClient = new Map<string, number>();
    for (const campaign of campaigns) {
      if (!campaign.clientId) continue;
      campaignCountByClient.set(
        campaign.clientId,
        (campaignCountByClient.get(campaign.clientId) ?? 0) + 1,
      );
    }
    return [...clients]
      .map((client) => ({
        client,
        campaignCount: campaignCountByClient.get(client.id) ?? 0,
      }))
      .sort((a, b) => {
        if (a.campaignCount !== b.campaignCount) return a.campaignCount - b.campaignCount;
        return a.client.assessmentCount - b.client.assessmentCount;
      })
      .slice(0, 6);
  }, [clients, campaigns]);

  return (
    <div className="max-w-5xl space-y-16">
      <RefreshOnFocus />

      {/* ===== HERO ===== */}
      <header className="space-y-6 pt-4">
        <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">
          This week · {weekRange}
        </p>
        <h1 className="font-sans text-[clamp(2.25rem,4.5vw,3.75rem)] font-extrabold leading-[1.05] tracking-[-0.03em] text-foreground">
          What&rsquo;s moving <span className="text-[var(--emerald)]">across your portfolio.</span>
        </h1>
        <p className="max-w-xl text-[1.0625rem] leading-relaxed text-muted-foreground">
          {clients.length === 0 ? (
            "No clients yet — create your first to assign assessments and launch a campaign."
          ) : activeCount === 0 ? (
            "No active campaigns yet — launch one for a client to start seeing activity here."
          ) : leadCampaign && leadDays != null && leadDays >= 0 ? (
            <>
              {leadCampaign.clientName ? `${leadCampaign.clientName} · ` : ""}
              <Link
                href={`/partner/campaigns/${leadCampaign.id}`}
                className="font-medium text-foreground underline decoration-[var(--gold)] decoration-2 underline-offset-4 transition-colors hover:text-[var(--emerald)]"
              >
                {leadCampaign.title}
              </Link>{" "}
              {describeDeadline(leadDays)} at {leadPct}% done
              {leadPending > 0 ? `, with ${leadPending} still to finish.` : "."}
            </>
          ) : (
            `${activeCount} active campaign${activeCount === 1 ? "" : "s"} across ${clients.length} client${clients.length === 1 ? "" : "s"}.`
          )}
        </p>
      </header>

      {/* ===== QUICK ACTIONS ===== */}
      <section className="space-y-4">
        <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">
          Quick actions
        </p>
        <div className="flex flex-wrap gap-3">
          <LaunchCampaignButton
            label="Create campaign"
            assessments={launchAssessments}
            clients={clients.map((c) => ({ id: c.id, name: c.name }))}
            recentCampaigns={campaigns}
            successHrefPrefix="/partner/campaigns"
          />
          <Link
            href="/partner/clients/create"
            className={cn(buttonVariants({ variant: "outline" }), "border-foreground/20")}
          >
            <Building2 className="size-4" />
            New client
          </Link>
          <Link
            href="/partner/participants"
            className={cn(buttonVariants({ variant: "outline" }), "border-foreground/20")}
          >
            <ArrowUpRight className="size-4" />
            View results
          </Link>
        </div>
      </section>

      {/* ===== METRIC STRIP ===== */}
      <section className="grid gap-8 border-t border-b border-border/70 py-8 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between gap-4">
            <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Completions
            </p>
            {completionTimeline.length > 0 && (
              <span
                className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground/70"
                title="Completions per day over the last 14 days"
              >
                14d trend
              </span>
            )}
          </div>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="font-sans text-[4rem] font-extrabold leading-none tracking-[-0.035em] tabular-nums text-foreground">
              {totalCompleted}
            </span>
            <span className="font-mono text-sm text-muted-foreground">/ {totalParticipants}</span>
          </div>
          {completionTimeline.length > 0 && (
            <div className="mt-3">
              <Sparkline values={completionTimeline.map((p) => p.count)} width={220} height={36} />
            </div>
          )}
          <p className="mt-3 text-sm text-muted-foreground">
            {totalParticipants === 0
              ? "No participants invited yet."
              : stillPending === 0
                ? "All invited participants have completed."
                : `${stillPending} still to finish.`}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-8 lg:col-span-3 lg:border-l lg:border-border/70 lg:pl-10">
          {[
            {
              label: "Active",
              value: activeCount,
              suffix: activeCount === 1 ? "campaign running" : "campaigns running",
            },
            {
              label: "Clients",
              value: clients.length,
              suffix:
                clientsWithActive === 0
                  ? "none with a campaign running"
                  : `${clientsWithActive} with a campaign running`,
            },
            {
              label: "Closing this week",
              value: closingSoon.length,
              suffix: "to watch closely",
            },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {stat.label}
              </p>
              <p className="mt-2 font-sans text-3xl font-extrabold leading-none tracking-[-0.025em] tabular-nums text-foreground">
                {stat.value}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">{stat.suffix}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== TOP THREE TO WATCH ===== */}
      <section className="space-y-5">
        <SectionHeading
          eyebrow="Top three to watch"
          title="Favourites first, then closing soonest."
          href="/partner/campaigns"
          linkLabel="All campaigns"
        />

        {rankedCampaigns.length === 0 ? (
          <EmptyState
            size="sm"
            eyebrow="No active campaigns"
            title="Nothing to watch this week."
            description="Launch a campaign for one of your clients — it'll show up here as soon as invites go out."
          />
        ) : (
          <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border bg-card">
            {rankedCampaigns.map((campaign) => {
              const pct =
                campaign.participantCount === 0
                  ? 0
                  : Math.round((campaign.completedCount / campaign.participantCount) * 100);
              const days = daysUntil(campaign.closesAt);
              const urgent = days != null && days >= 0 && days <= 7;
              const isFav = favoriteSet.has(campaign.id);

              return (
                <li
                  key={campaign.id}
                  className="group relative flex items-center gap-5 px-6 py-5 transition-colors hover:bg-[var(--cream)]/60"
                >
                  <div className="relative flex items-center justify-center text-[var(--emerald)]">
                    <CompletionRing value={pct} />
                    <span className="absolute inset-0 flex items-center justify-center font-mono text-[0.625rem] font-semibold tabular-nums text-foreground">
                      {pct}%
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {isFav && (
                        <Star
                          className="size-3.5 fill-[var(--gold)] text-[var(--gold)]"
                          aria-label="Favourite"
                        />
                      )}
                      <Link
                        href={`/partner/campaigns/${campaign.id}`}
                        className="truncate font-sans text-[0.9375rem] font-semibold tracking-[-0.01em] text-foreground transition-colors group-hover:text-[var(--emerald)]"
                      >
                        {campaign.title}
                      </Link>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {campaign.clientName && (
                        <>
                          <span className="truncate font-medium text-foreground/70">
                            {campaign.clientName}
                          </span>
                          <span className="text-border">·</span>
                        </>
                      )}
                      <span className="inline-flex items-center gap-1.5">
                        <StatusDot status={campaign.status} />
                        <span className="capitalize">{campaign.status}</span>
                      </span>
                      <span className="text-border">·</span>
                      <span className="font-mono tabular-nums">
                        {campaign.completedCount}/{campaign.participantCount} completed
                      </span>
                      {days != null && days >= 0 && (
                        <>
                          <span className="text-border">·</span>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1",
                              urgent
                                ? "font-medium text-[var(--emerald-dark)]"
                                : "text-muted-foreground",
                            )}
                          >
                            <CalendarDays className="size-3" />
                            {days === 0
                              ? "closes today"
                              : days === 1
                                ? "closes tomorrow"
                                : `${days} days left`}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <FavoriteCampaignButton campaignId={campaign.id} isFavorite={isFav} />
                    <Link
                      href={`/partner/campaigns/${campaign.id}/participants`}
                      className={buttonVariants({ variant: "ghost", size: "sm" })}
                    >
                      Open
                      <ArrowRight className="size-4" />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ===== RECENT ACTIVITY ===== */}
      <section className="space-y-4">
        <SectionHeading
          eyebrow="Recent activity"
          title="Latest participant movements."
          href="/partner/participants"
          linkLabel="All participants"
        />

        {recentResults.length === 0 ? (
          <EmptyState
            size="sm"
            eyebrow="Quiet for now"
            title="No recent activity."
            description="Results stream in here as participants across your clients start and complete their assessments."
          />
        ) : (
          <ul className="space-y-1">
            {recentResults.map((result) => {
              const resultHref = result.latestSessionId
                ? `/partner/campaigns/${result.campaignId}/sessions/${result.latestSessionId}`
                : `/partner/campaigns/${result.campaignId}/participants/${result.participantId}`;
              return (
                <li key={`${result.participantId}-${result.latestSessionId ?? "none"}`}>
                  <Link
                    href={resultHref}
                    className="group relative flex cursor-pointer items-center gap-4 rounded-xl px-3 py-3 transition-all duration-200 ease-[var(--ease-spring)] hover:bg-[var(--cream)] hover:pl-5 hover:pr-2 hover:shadow-sm"
                  >
                    <span
                      aria-hidden
                      className="absolute left-0 top-2 bottom-2 w-[2px] origin-center scale-y-0 rounded-full bg-[var(--gold)] transition-transform duration-200 ease-[var(--ease-spring)] group-hover:scale-y-100"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-sans text-sm font-medium text-foreground transition-colors group-hover:text-[var(--emerald-dark)]">
                        {result.participantName}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {result.clientName} · {result.campaignTitle}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-muted-foreground">
                        {result.status}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <LocalTime iso={result.lastActivity} format="relative" />
                      </p>
                    </div>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground/60 transition-all duration-200 group-hover:translate-x-1 group-hover:text-[var(--emerald)]" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {/* ===== CLIENTS ===== */}
      <section className="space-y-5 pb-16">
        <SectionHeading
          eyebrow="Clients"
          title="Where attention goes next."
          href="/partner/clients"
          linkLabel="All clients"
        />

        {clients.length === 0 ? (
          <EmptyState
            size="sm"
            eyebrow="No clients yet"
            title="Your portfolio is empty."
            description="Create your first client to assign assessments and launch campaigns."
            actionLabel="New client"
            actionHref="/partner/clients/create"
          />
        ) : (
          <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border bg-card">
            {clientsNeedingAttention.map(({ client, campaignCount }) => (
              <li
                key={client.id}
                className="group flex items-center gap-4 px-6 py-4 transition-colors hover:bg-[var(--cream)]/60"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/partner/clients/${client.slug}/overview`}
                    className="truncate font-sans text-[0.9375rem] font-semibold tracking-[-0.01em] text-foreground transition-colors group-hover:text-[var(--emerald)]"
                  >
                    {client.name}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {client.assessmentCount === 0 && (
                      <Badge variant="outline" className={WARNING_BADGE}>
                        No assessments assigned
                      </Badge>
                    )}
                    {campaignCount === 0 && <Badge variant="outline">No campaigns</Badge>}
                    <span className="font-mono tabular-nums">
                      {client.sessionCount} session{client.sessionCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground/60 transition-all duration-200 group-hover:translate-x-1 group-hover:text-[var(--emerald)]" />
              </li>
            ))}
          </ul>
        )}
      </section>

    </div>
  );
}
