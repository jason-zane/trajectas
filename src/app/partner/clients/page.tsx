import Link from "next/link";
import { Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button-variants";
import { getClients } from "@/app/actions/clients";
import {
  canManageClient,
  canManageClientDirectory,
  resolveAuthorizedScope,
} from "@/lib/auth/authorization";
import { ClientsTable } from "./clients-table";

export default async function PartnerClientsPage() {
  const [clients, scope] = await Promise.all([
    getClients(),
    resolveAuthorizedScope(),
  ]);

  // Ordinary partner members read the portfolio; only partner admins reach the
  // console or create clients. Offering either to a member would send them
  // straight to an unauthorized page.
  const manageableClientIds = clients
    .filter((client) => canManageClient(scope, client.id))
    .map((client) => client.id);
  const canCreate = canManageClientDirectory(scope);

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        eyebrow="Clients"
        title="Client portfolio"
        description={`${clients.length} client${clients.length !== 1 ? "s" : ""} in your portfolio.`}
      >
        {canCreate ? (
          <Link href="/partner/clients/create" className={buttonVariants()}>
            <Plus className="size-4" />
            New Client
          </Link>
        ) : null}
      </PageHeader>
      {clients.length === 0 ? (
        <EmptyState
          eyebrow="Clients"
          title="No clients yet"
          description={
            canCreate
              ? "Create your first client to assign assessments, set quotas and launch campaigns."
              : "No clients have been added to this portfolio yet."
          }
          actionLabel={canCreate ? "New client" : undefined}
          actionHref={canCreate ? "/partner/clients/create" : undefined}
        />
      ) : (
        <ClientsTable
          clients={clients}
          manageableClientIds={manageableClientIds}
        />
      )}
    </div>
  );
}
