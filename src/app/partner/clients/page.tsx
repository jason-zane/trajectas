import { PageHeader } from "@/components/page-header";
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
      />
      <ClientsTable clients={clients} />
    </div>
  );
}
