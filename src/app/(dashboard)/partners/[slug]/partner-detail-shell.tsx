"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { RouteTabs } from "@/components/route-tabs";
import type { Partner } from "@/types/database";

const tabs = [
  { label: "Overview", segment: "overview" },
  { label: "Details", segment: "details" },
  { label: "Clients", segment: "clients" },
  { label: "Assessments", segment: "assessments" },
  { label: "Reports", segment: "reports" },
  { label: "Library", segment: "library" },
  { label: "Users", segment: "users" },
  { label: "Branding", segment: "branding" },
  { label: "Settings", segment: "settings" },
];

export function PartnerDetailShell({
  partner,
  children,
}: {
  partner: Partner;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const activeSegment =
    tabs.find((t) => pathname.endsWith(`/${t.segment}`))?.segment ?? "overview";

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        eyebrow="Partners"
        title={partner.name}
      >
        {!partner.isActive && (
          <Badge variant="outline">Archived</Badge>
        )}
      </PageHeader>

      <RouteTabs
        tabs={tabs}
        basePath={`/partners/${partner.slug}`}
        activeSegment={activeSegment}
      />

      {children}
    </div>
  );
}
