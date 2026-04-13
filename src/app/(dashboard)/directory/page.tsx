import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { getClientDirectoryEntries } from "@/app/actions/clients";
import { getPartners } from "@/app/actions/partners";
import {
  canManageClientDirectory,
  canManagePartnerDirectory,
  resolveAuthorizedScope,
} from "@/lib/auth/authorization";
import { ClientDirectoryTable } from "./client-directory-table";
import { PartnerDirectoryTable } from "./partner-directory-table";

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
    <div className="max-w-6xl space-y-8">
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
        <ClientDirectoryTable clients={clients} />
      ) : (
        <PartnerDirectoryTable partners={partners} />
      )}
    </div>
  );
}
