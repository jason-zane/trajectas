"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
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
  { label: "Results", segment: "results" },
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

export function CampaignDetailShell({
  campaign,
  canCustomizeBranding,
  children,
}: {
  campaign: CampaignDetail;
  canCustomizeBranding?: boolean;
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

  const activeSegment =
    tabs.find((t) => pathname.endsWith(`/${t.segment}`))?.segment ?? "overview";

  const basePath = href(`/campaigns/${campaign.id}`);

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        eyebrow="Campaigns"
        title={campaign.title}
        description={campaign.clientName}
      >
        <Badge variant={statusVariant[campaign.status] ?? "secondary"}>
          {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
        </Badge>
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
