"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import type { Client } from "@/types/database";

const tabs = [
  { label: "Overview", segment: "overview" },
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
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        eyebrow="Clients"
        title={client.name}
        description={client.industry ?? undefined}
      >
        {!client.isActive && (
          <Badge variant="outline">Archived</Badge>
        )}
      </PageHeader>

      <nav className="flex gap-1 border-b border-border">
        {tabs.map((tab) => {
          const isActive = activeSegment === tab.segment;
          return (
            <Link
              key={tab.segment}
              href={`/clients/${client.slug}/${tab.segment}`}
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
