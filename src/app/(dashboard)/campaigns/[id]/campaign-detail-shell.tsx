"use client";

import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { FavoriteCampaignButton } from "@/components/campaigns/favorite-campaign-button";
import { PageHeader } from "@/components/page-header";
import { RouteTabs } from "@/components/route-tabs";
import { usePortal } from "@/components/portal-context";
import type { CampaignDetail } from "@/app/actions/campaigns";

const allTabs = (showAssessmentsAlert: boolean) => [
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
  { label: "Participants", segment: "participants" },
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
  campaign: CampaignDetail;
  canCustomizeBranding?: boolean;
  isFavorite?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { portal, href } = usePortal();

  const showAssessmentsAlert = campaign.assessments.length === 0;
  const tabs = allTabs(showAssessmentsAlert).filter((tab) => {
    if (tab.segment === "branding" && portal === "client" && !canCustomizeBranding) {
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
