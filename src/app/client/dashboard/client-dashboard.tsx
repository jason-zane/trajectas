"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Star,
  Users,
} from "lucide-react";

import type {
  CampaignAssessmentOption,
  CampaignWithMeta,
  ClientRecentResult,
  OperationalClientCampaign,
} from "@/app/actions/campaigns";
import { CopyCampaignLinkButton } from "@/components/campaigns/copy-campaign-link-button";
import { EmptyState } from "@/components/empty-state";
import { FavoriteCampaignButton } from "@/components/campaigns/favorite-campaign-button";
import { LaunchCampaignButton } from "@/components/campaigns/launch-campaign-button";
import { LocalTime } from "@/components/local-time";
import { usePortal } from "@/components/portal-context";
import { RefreshOnFocus } from "@/components/refresh-on-focus";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

interface ClientDashboardProps {
  campaigns: CampaignWithMeta[];
  operationalCampaigns: OperationalClientCampaign[];
  recentResults: ClientRecentResult[];
  launchAssessments: CampaignAssessmentOption[];
  clientId: string;
  favoriteCampaignIds?: string[];
}

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
  const diffMs = target - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function CompletionRing({
  value,
  size = 40,
}: {
  value: number;
  size?: number;
}) {
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, value));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      aria-hidden
    >
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

function StatusDot({ status }: { status: string }) {
  const color =
    status === "active"
      ? "bg-[var(--emerald)]"
      : status === "paused"
        ? "bg-[var(--gold)]"
        : status === "closed"
          ? "bg-destructive"
          : "bg-muted-foreground/40";
  return (
    <span
      className={cn("inline-block size-1.5 rounded-full", color)}
      aria-hidden
    />
  );
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
  const favoriteSet = useMemo(
    () => new Set(favoriteCampaignIds),
    [favoriteCampaignIds],
  );

  const weekRange = useMemo(() => formatWeekRange(new Date()), []);

  const activeCampaigns = campaigns.filter((c) => c.status === "active");
  const activeCount = activeCampaigns.length;
  // Headline "Completions" is scoped to active campaigns only — paused / closed
  // / draft campaigns shouldn't skew a weekly "what's moving" snapshot.
  const totalParticipants = activeCampaigns.reduce(
    (sum, c) => sum + c.participantCount,
    0,
  );
  const totalCompleted = activeCampaigns.reduce(
    (sum, c) => sum + c.completedCount,
    0,
  );
  const completionRate =
    totalParticipants === 0
      ? 0
      : Math.round((totalCompleted / totalParticipants) * 100);

  const closingSoon = campaigns.filter((c) => {
    if (c.status !== "active") return false;
    const d = daysUntil(c.closesAt);
    return d != null && d >= 0 && d <= 7;
  });
  const stillPending = Math.max(0, totalParticipants - totalCompleted);

  // Sort for the "What's moving" list:
  // 1. favorites first
  // 2. closing within 7 days next
  // 3. rest by most recent activity (created_at proxy)
  const rankedCampaigns = useMemo(() => {
    const list = [...operationalCampaigns];
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
  }, [operationalCampaigns, favoriteSet]);

  // Top campaign for the narrative lede — the one you'd want to act on first.
  const leadCampaign = rankedCampaigns[0];
  const leadDays = leadCampaign ? daysUntil(leadCampaign.closesAt) : null;
  const leadPct =
    leadCampaign && leadCampaign.participantCount > 0
      ? Math.round(
          (leadCampaign.completedCount / leadCampaign.participantCount) * 100,
        )
      : 0;
  const leadPending = leadCampaign
    ? Math.max(0, leadCampaign.participantCount - leadCampaign.completedCount)
    : 0;

  function describeDeadline(days: number): string {
    if (days < 0) return "closed";
    if (days === 0) return "closes today";
    if (days === 1) return "closes tomorrow";
    if (days <= 7) return `closes in ${days} days`;
    return `closes in ${days} days`;
  }

  return (
    <div className="max-w-5xl space-y-16">
      <RefreshOnFocus />
      {/* ===== HERO — editorial header ===== */}
      <header className="space-y-6 pt-4">
        <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">
          This week · {weekRange}
        </p>
        <h1 className="font-sans text-[clamp(2.25rem,4.5vw,3.75rem)] font-extrabold leading-[1.05] tracking-[-0.03em] text-foreground">
          What&rsquo;s moving{" "}
          <span className="text-[var(--emerald)]">this week.</span>
        </h1>
        <p className="max-w-xl text-[1.0625rem] leading-relaxed text-muted-foreground">
          {activeCount === 0 ? (
            "No active campaigns yet — launch your first to start seeing activity here."
          ) : leadCampaign && leadDays != null && leadDays >= 0 ? (
            <>
              <Link
                href={href(`/campaigns/${leadCampaign.id}`)}
                className="font-medium text-foreground underline decoration-[var(--gold)] decoration-2 underline-offset-4 transition-colors hover:text-[var(--emerald)]"
              >
                {leadCampaign.title}
              </Link>{" "}
              {describeDeadline(leadDays)} at {leadPct}% done
              {leadPending > 0
                ? `, with ${leadPending} still to finish.`
                : "."}
            </>
          ) : (
            `${activeCount} active campaign${activeCount === 1 ? "" : "s"} in flight.`
          )}
        </p>
      </header>

      {/* ===== METRIC STRIP — one headline, two framing stats ===== */}
      <section className="grid gap-8 border-t border-b border-border/70 py-8 lg:grid-cols-5">
        {/* Headline metric */}
        <div className="lg:col-span-2">
          <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Completions
          </p>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="font-sans text-[4rem] font-extrabold leading-none tracking-[-0.035em] tabular-nums text-foreground">
              {totalCompleted}
            </span>
            <span className="font-mono text-sm text-muted-foreground">
              / {totalParticipants}
            </span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {stillPending === 0
              ? "All invited participants have completed."
              : `${stillPending} still to finish.`}
          </p>
        </div>

        {/* Framing stats */}
        <div className="grid grid-cols-2 gap-8 lg:col-span-3 lg:border-l lg:border-border/70 lg:pl-10">
          {[
            {
              label: "Active",
              value: activeCount,
              suffix: activeCount === 1 ? "campaign running" : "campaigns running",
            },
            {
              label: "Closing this week",
              value: closingSoon.length,
              suffix:
                closingSoon.length === 1
                  ? "to watch closely"
                  : "to watch closely",
            },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {stat.label}
              </p>
              <p className="mt-2 font-sans text-3xl font-extrabold leading-none tracking-[-0.025em] tabular-nums text-foreground">
                {stat.value}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {stat.suffix}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== QUICK ACTIONS ===== */}
      <section className="space-y-4">
        <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">
          Quick actions
        </p>
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
            href={href("/participants?action=invite")}
            className={buttonVariants({ variant: "outline" })}
          >
            <Users className="size-4" />
            Invite participants
          </Link>
          <Link
            href={href("/participants?view=sessions")}
            className={buttonVariants({ variant: "outline" })}
          >
            <ArrowUpRight className="size-4" />
            View recent results
          </Link>
        </div>
      </section>

      {/* ===== WHAT'S MOVING — prioritised campaign list ===== */}
      <section className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">
              Top three to watch
            </p>
            <h2 className="mt-2 font-sans text-2xl font-bold tracking-[-0.02em] text-foreground">
              Favourites first, then closing soonest.
            </h2>
          </div>
          <Link
            href={href("/campaigns")}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            All campaigns
            <ArrowRight className="size-4" />
          </Link>
        </div>

        {rankedCampaigns.length === 0 ? (
          <EmptyState
            size="sm"
            eyebrow="No campaigns yet"
            title="Nothing to watch this week."
            description="Launch your first campaign above — it'll show up here as soon as invites go out."
          />
        ) : (
          <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border bg-card">
            {rankedCampaigns.map((campaign) => {
              const pct =
                campaign.participantCount === 0
                  ? 0
                  : Math.round(
                      (campaign.completedCount / campaign.participantCount) *
                        100,
                    );
              const days = daysUntil(campaign.closesAt);
              const urgent = days != null && days >= 0 && days <= 7;
              const isFav = favoriteSet.has(campaign.id);

              return (
                <li
                  key={campaign.id}
                  className="group relative flex items-center gap-5 px-6 py-5 transition-colors hover:bg-[var(--cream)]/60"
                >
                  {/* Completion ring */}
                  <div className="relative flex items-center justify-center text-[var(--emerald)]">
                    <CompletionRing value={pct} size={44} />
                    <span className="absolute inset-0 flex items-center justify-center font-mono text-[0.625rem] font-semibold tabular-nums text-foreground">
                      {pct}%
                    </span>
                  </div>

                  {/* Meta */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {isFav && (
                        <Star
                          className="size-3.5 fill-[var(--gold)] text-[var(--gold)]"
                          aria-label="Favourite"
                        />
                      )}
                      <Link
                        href={href(`/campaigns/${campaign.id}`)}
                        className="truncate font-sans text-[0.9375rem] font-semibold tracking-[-0.01em] text-foreground transition-colors group-hover:text-[var(--emerald)]"
                      >
                        {campaign.title}
                      </Link>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <StatusDot status={campaign.status} />
                        <span className="capitalize">{campaign.status}</span>
                      </span>
                      <span className="text-border">·</span>
                      <span className="font-mono tabular-nums">
                        {campaign.completedCount}/{campaign.participantCount}{" "}
                        completed
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

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-2">
                    <FavoriteCampaignButton
                      campaignId={campaign.id}
                      isFavorite={isFav}
                    />
                    <CopyCampaignLinkButton
                      token={campaign.primaryAccessLink?.token}
                      createHref={href(
                        `/campaigns/${campaign.id}/participants?action=link`,
                      )}
                      size="sm"
                      variant="outline"
                    />
                    <Link
                      href={href(`/campaigns/${campaign.id}/participants`)}
                      className={buttonVariants({
                        variant: "ghost",
                        size: "sm",
                      })}
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
      <section className="space-y-4 pb-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">
              Recent activity
            </p>
            <h2 className="mt-2 font-sans text-2xl font-bold tracking-[-0.02em] text-foreground">
              Latest participant movements.
            </h2>
          </div>
          <Link
            href={href("/participants?view=sessions")}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            All participants
            <ArrowRight className="size-4" />
          </Link>
        </div>

        {recentResults.length === 0 ? (
          <EmptyState
            size="sm"
            eyebrow="Quiet for now"
            title="No recent activity."
            description="Results stream in here as participants start and complete their assessments."
          />
        ) : (
          <ul className="space-y-1">
            {recentResults.map((result) => {
              const resultHref = result.latestSessionId
                ? href(
                    `/campaigns/${result.campaignId}/sessions/${result.latestSessionId}`,
                  )
                : href(
                    `/campaigns/${result.campaignId}/participants/${result.participantId}`,
                  );
              return (
                <li key={`${result.participantId}-${result.latestSessionId ?? "none"}`}>
                  <Link
                    href={resultHref}
                    className="group relative flex cursor-pointer items-center gap-4 rounded-xl px-3 py-3 transition-all duration-200 ease-[var(--ease-spring)] hover:bg-[var(--cream)] hover:pl-5 hover:pr-2 hover:shadow-sm"
                  >
                    {/* Gold accent bar that slides in on hover */}
                    <span
                      aria-hidden
                      className="absolute left-0 top-2 bottom-2 w-[2px] origin-center scale-y-0 rounded-full bg-[var(--gold)] transition-transform duration-200 ease-[var(--ease-spring)] group-hover:scale-y-100"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-sans text-sm font-medium text-foreground transition-colors group-hover:text-[var(--emerald-dark)]">
                        {result.participantName}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {result.campaignTitle}
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
    </div>
  );
}
