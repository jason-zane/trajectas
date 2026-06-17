"use client";

import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { RouteTabs } from "@/components/route-tabs";
import type { Client } from "@/types/database";

const ALL_TABS = [
  { label: "Overview", segment: "overview" },
  { label: "Details", segment: "details" },
  { label: "Assessments", segment: "assessments" },
  { label: "Reports", segment: "reports" },
  { label: "Users", segment: "users" },
  { label: "Branding", segment: "branding" },
  { label: "Billing", segment: "billing" },
  { label: "Settings", segment: "settings" },
];

export function ClientDetailShell({
  client,
  children,
  isPlatformAdmin,
}: {
  client: Client;
  children: React.ReactNode;
  isPlatformAdmin: boolean;
}) {
  const pathname = usePathname();
  // Billing is platform-admin only (matches the gate on the billing page).
  const tabs = isPlatformAdmin
    ? ALL_TABS
    : ALL_TABS.filter((t) => t.segment !== "billing");
  const activeSegment =
    tabs.find((t) => pathname.endsWith(`/${t.segment}`))?.segment ?? "overview";

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        eyebrow="Clients"
        title={client.name}
        description={client.industry ?? undefined}
      >
        {!client.isActive && (
          <Badge variant="outline">Archived</Badge>
        )}
      </PageHeader>

      <RouteTabs
        tabs={tabs}
        basePath={`/clients/${client.slug}`}
        activeSegment={activeSegment}
      />

      {children}
    </div>
  );
}
