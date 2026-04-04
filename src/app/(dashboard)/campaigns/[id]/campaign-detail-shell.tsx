"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { usePortal } from "@/components/portal-context";
import type { CampaignDetail } from "@/app/actions/campaigns";

const allTabs = [
  { label: "Overview", segment: "overview" },
  { label: "Assessments", segment: "assessments" },
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

  const tabs = allTabs.filter((tab) => {
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
        description={campaign.organizationName}
      >
        <Badge variant={statusVariant[campaign.status] ?? "secondary"}>
          {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
        </Badge>
      </PageHeader>

      <nav className="flex gap-1 border-b border-border">
        {tabs.map((tab) => {
          const isActive = activeSegment === tab.segment;
          return (
            <Link
              key={tab.segment}
              href={`${basePath}/${tab.segment}`}
              className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
              )}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
