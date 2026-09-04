"use client";

import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { FavoriteCampaignButton } from "@/components/campaigns/favorite-campaign-button";
import { PageHeader } from "@/components/page-header";
import { RouteTabs } from "@/components/route-tabs";
import { usePortal } from "@/components/portal-context";
import type { CampaignHeader } from "@/app/actions/campaigns";

const allTabs = (showAssessmentsAlert: boolean, kind: string) => [
  { label: "Overview", segment: "overview" },
  {
    label: "Assessments",
    segment: "assessments",
    badge: showAssessmentsAlert ? (
      <>
        <span aria-hidden="true" className="size-2 rounded-full bg-destructive" />
        <span className="sr-only">No assessments attached</span>
      </>
    ) : undefined,
  },
  // A 360 manages one subject + their raters; a self campaign manages participants.
  kind === "leadership_360"
    ? { label: "Subject & Raters", segment: "raters" }
    : { label: "Participants", segment: "participants" },
  // 360 results report (admin only — gated in the filter below).
  ...(kind === "leadership_360"
    ? [{ label: "Results", segment: "results" }]
    : []),
  { label: "Experience", segment: "experience" },
  { label: "Branding", segment: "branding" },
  { label: "Settings", segment: "settings" },
];

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

const statusClassName: Record<string, string> = {
  // Active campaigns get a gold accent — they're the "live" signal that
  // should catch the eye when scanning a list of campaign detail pages.
  active:
    "border-[var(--gold)]/40 bg-[var(--gold)]/15 text-[var(--emerald-dark)] hover:bg-[var(--gold)]/25",
};

export function CampaignDetailShell({
  campaign,
  canCustomizeBranding,
  isFavorite = false,
  children,
}: {
  campaign: CampaignHeader;
  canCustomizeBranding?: boolean;
  isFavorite?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { portal, href } = usePortal();

  const showAssessmentsAlert = campaign.assessmentCount === 0;
  const tabs = allTabs(showAssessmentsAlert, campaign.kind).filter((tab) => {
    // Branding is feature-gated on both tenant portals: the client's own flag
    // for the client portal, the partner's flag for the partner portal (D11).
    if (
      tab.segment === "branding" &&
      (portal === "client" || portal === "partner") &&
      !canCustomizeBranding
    ) {
      return false;
    }
    // 360 rater management is an admin-only test-bed surface — the route only
    // exists under the dashboard. Hide it in client/partner portals (no route
    // there, and the loader requires platform admin).
    if ((tab.segment === "raters" || tab.segment === "results") && portal !== "admin") {
      return false;
    }
    return true;
  });

  const basePath = href(`/campaigns/${campaign.id}`);

  // Derive the active segment from the segment immediately after the campaign ID,
  // not by endsWith() — nested routes like /participants/[pid]/sessions/[sid] have
  // more path segments but should still light up the "Participants" tab.
  const afterBase = pathname.startsWith(basePath)
    ? pathname.slice(basePath.length).replace(/^\/+/, "").split("/")[0]
    : "";
  const activeSegment =
    tabs.find((t) => t.segment === afterBase)?.segment ?? "overview";

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        eyebrow="Campaigns"
        title={campaign.title}
        description={campaign.clientName}
      >
        <div className="flex items-center gap-2">
          <FavoriteCampaignButton
            campaignId={campaign.id}
            isFavorite={isFavorite}
          />
          {campaign.kind === "leadership_360" && (
            <Badge variant="outline" className="border-primary/40 text-primary">
              360
            </Badge>
          )}
          <Badge
            variant={statusVariant[campaign.status] ?? "secondary"}
            className={statusClassName[campaign.status]}
          >
            {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
          </Badge>
        </div>
      </PageHeader>

      <RouteTabs
        tabs={tabs}
        basePath={basePath}
        activeSegment={activeSegment}
        className="gap-1"
      />

      {children}
    </div>
  );
}
