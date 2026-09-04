import Link from "next/link";
import { Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button-variants";
import { getClients } from "@/app/actions/clients";
import { ClientsTable } from "./clients-table";

export default async function PartnerClientsPage() {
  const clients = await getClients();
  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        eyebrow="Clients"
        title="Client portfolio"
        description={`${clients.length} client${clients.length !== 1 ? "s" : ""} in your portfolio.`}
      >
        <Link href="/partner/clients/create" className={buttonVariants()}>
          <Plus className="size-4" />
          New Client
        </Link>
      </PageHeader>
      {clients.length === 0 ? (
        <EmptyState
          eyebrow="Clients"
          title="No clients yet"
          description="Create your first client to assign assessments, set quotas and launch campaigns."
          actionLabel="New client"
          actionHref="/partner/clients/create"
        />
      ) : (
        <ClientsTable clients={clients} />
      )}
    </div>
  );
}
