"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { RouteTabs } from "@/components/route-tabs";
import type { Client } from "@/types/database";

const ALL_TABS = [
  { label: "Overview", segment: "overview" },
  { label: "Details", segment: "details" },
  { label: "Assessments", segment: "assessments" },
  { label: "Reports", segment: "reports" },
  { label: "Usage", segment: "usage" },
  { label: "Users", segment: "users" },
  { label: "Branding", segment: "branding" },
  { label: "Billing", segment: "billing" },
  { label: "Features & Experience", segment: "features" },
  { label: "Settings", segment: "settings" },
];

export function ClientDetailShell({
  client,
  children,
  isPlatformAdmin,
  basePath,
}: {
  client: Client;
  children: React.ReactNode;
  isPlatformAdmin: boolean;
  /** Tab root. Defaults to the admin console; the partner portal passes its own. */
  basePath?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Billing is platform-admin only (matches the gate on the billing page).
  const tabs = isPlatformAdmin
    ? ALL_TABS
    : ALL_TABS.filter((t) => t.segment !== "billing" && t.segment !== "features");
  const activeSegment =
    tabs.find((t) => pathname.endsWith(`/${t.segment}`))?.segment ?? "overview";

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        eyebrow="Clients"
        title={client.name}
        description={client.industry ?? undefined}
      >
        {!client.isActive && <Badge variant="outline">Archived</Badge>}
      </PageHeader>

      <RouteTabs
        tabs={tabs}
        basePath={basePath ?? `/clients/${client.slug}`}
        activeSegment={activeSegment}
        queryForSegment={(segment) => {
          if (!["usage", "billing"].includes(segment)) return "";
          const query = new URLSearchParams();
          for (const key of ["period", "month", "from", "to"]) {
            const value = searchParams.get(key);
            if (value) query.set(key, value);
          }
          if (
            !query.has("period") &&
            ["usage", "billing"].includes(activeSegment)
          ) {
            query.set(
              "period",
              activeSegment === "billing" ? "last-month" : "this-month",
            );
          }
          return query.size ? `?${query}` : "";
        }}
      />

      {children}
    </div>
  );
}
