"use client";

import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { RouteTabs } from "@/components/route-tabs";
import type { Client } from "@/types/database";

const tabs = [
  { label: "Overview", segment: "overview" },
  { label: "Details", segment: "details" },
  { label: "Assessments", segment: "assessments" },
  { label: "Reports", segment: "reports" },
  { label: "Users", segment: "users" },
  { label: "Branding", segment: "branding" },
  { label: "Settings", segment: "settings" },
];

export function ClientDetailShell({
  client,
  children,
}: {
  client: Client;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
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
