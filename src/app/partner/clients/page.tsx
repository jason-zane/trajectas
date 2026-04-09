import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
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
      <ClientsTable clients={clients} />
    </div>
  );
}
