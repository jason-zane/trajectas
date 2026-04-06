import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Building2,
  BriefcaseBusiness,
  ClipboardList,
  Plus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ScrollReveal } from "@/components/scroll-reveal";
import { TiltCard } from "@/components/tilt-card";
import { getClientDirectoryEntries } from "@/app/actions/clients";
import { getPartners } from "@/app/actions/partners";
import {
  canManageClientDirectory,
  canManagePartnerDirectory,
  resolveAuthorizedScope,
} from "@/lib/auth/authorization";

function TabLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link href={href}>
      <Button variant={active ? "default" : "outline"} size="sm">
        {label}
      </Button>
    </Link>
  );
}

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ tab }, scope] = await Promise.all([
    searchParams,
    resolveAuthorizedScope(),
  ]);

  const canManageClients = canManageClientDirectory(scope);
  const canManagePartners = canManagePartnerDirectory(scope);
  const activeTab =
    canManagePartners && tab === "partners" ? "partners" : "clients";

  if (!scope.isPlatformAdmin && scope.partnerIds.length === 0 && scope.clientIds.length === 0) {
    redirect("/unauthorized?reason=directory");
  }

  const [clients, partners] = await Promise.all([
    getClientDirectoryEntries(),
    canManagePartners ? getPartners() : Promise.resolve([]),
  ]);

  return (
    <div className="max-w-5xl space-y-8">
      <PageHeader
        title="Directory"
        description="Manage partner firms and client accounts from one place."
      >
        <div className="flex items-center gap-2">
          {canManagePartners ? (
            <TabLink
              href="/directory?tab=clients"
              label="Clients"
              active={activeTab === "clients"}
            />
          ) : null}
          {canManagePartners ? (
            <TabLink
              href="/directory?tab=partners"
              label="Partners"
              active={activeTab === "partners"}
            />
          ) : null}
          {activeTab === "clients" && canManageClients ? (
            <Link href="/clients/create">
              <Button>
                <Plus className="size-4" />
                Add Client
              </Button>
            </Link>
          ) : null}
          {activeTab === "partners" && canManagePartners ? (
            <Link href="/partners/create">
              <Button>
                <Plus className="size-4" />
                Add Partner
              </Button>
            </Link>
          ) : null}
        </div>
      </PageHeader>

      {activeTab === "clients" ? (
        clients.length === 0 ? (
          <EmptyState
            title="No clients yet"
            description="Create your first client to begin running assessments and diagnostics."
            actionLabel={canManageClients ? "Add Client" : undefined}
            actionHref={canManageClients ? "/clients/create" : undefined}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {clients.map((org, index) => (
              <ScrollReveal key={org.id} delay={index * 60}>
                <TiltCard>
                  <Link href={`/clients/${org.slug}/overview`}>
                    <Card variant="interactive">
                      <CardHeader>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-all duration-300 group-hover/card:shadow-[0_0_20px_var(--glow-color)]"
                              style={{ "--glow-color": "var(--primary)" } as React.CSSProperties}
                            >
                              <Building2 className="size-5 text-primary" />
                            </div>
                            <div>
                              <CardTitle>{org.name}</CardTitle>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <Badge variant="dot">
                                  <span
                                    className={`size-1.5 rounded-full ${org.deletedAt ? "bg-destructive" : org.isActive ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                                  />
                                  {org.deletedAt
                                    ? "Archived"
                                    : org.isActive
                                      ? "Active"
                                      : "Inactive"}
                                </Badge>
                                <Badge variant="secondary">
                                  {org.partnerName
                                    ? `Partner: ${org.partnerName}`
                                    : "Platform-owned"}
                                </Badge>
                                {org.industry ? (
                                  <Badge variant="secondary">{org.industry}</Badge>
                                ) : null}
                              </div>
                            </div>
                          </div>
                          <ArrowRight className="mt-1 size-4 text-muted-foreground opacity-0 transition-opacity group-hover/card:opacity-100" />
                        </div>
                      </CardHeader>
                      <CardContent>
                        {org.sizeRange ? (
                          <p className="mb-4 text-sm text-muted-foreground">
                            {org.sizeRange} employees
                          </p>
                        ) : null}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <ClipboardList className="size-3.5" />
                            <span>
                              {org.assessmentCount}{" "}
                              {org.assessmentCount === 1 ? "assessment" : "assessments"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Users className="size-3.5" />
                            <span>
                              {org.sessionCount}{" "}
                              {org.sessionCount === 1 ? "session" : "sessions"}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </TiltCard>
              </ScrollReveal>
            ))}
          </div>
        )
      ) : partners.length === 0 ? (
        <EmptyState
          title="No partners yet"
          description="Add your first partner to start assigning client accounts."
          actionLabel="Add Partner"
          actionHref="/partners/create"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {partners.map((partner, index) => (
            <ScrollReveal key={partner.id} delay={index * 60}>
              <TiltCard>
                <Link href={`/partners/${partner.slug}/edit`}>
                  <Card variant="interactive">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-all duration-300 group-hover/card:shadow-[0_0_20px_var(--glow-color)]"
                            style={{ "--glow-color": "var(--primary)" } as React.CSSProperties}
                          >
                            <BriefcaseBusiness className="size-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle>{partner.name}</CardTitle>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <Badge variant="dot">
                                <span
                                  className={`size-1.5 rounded-full ${partner.deletedAt ? "bg-destructive" : partner.isActive ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                                />
                                {partner.deletedAt
                                  ? "Archived"
                                  : partner.isActive
                                    ? "Active"
                                    : "Inactive"}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="mt-1 size-4 text-muted-foreground opacity-0 transition-opacity group-hover/card:opacity-100" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="size-3.5" />
                          <span>
                            {partner.clientCount}{" "}
                            {partner.clientCount === 1 ? "client" : "clients"}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </TiltCard>
            </ScrollReveal>
          ))}
        </div>
      )}
    </div>
  );
}
