import { notFound, redirect } from "next/navigation";
import { getPartnerBySlug, getPartnerClients, getUnassignedClients } from "@/app/actions/partners";
import { canManagePartnerDirectory, resolveAuthorizedScope } from "@/lib/auth/authorization";
import { PartnerClientsTable } from "./partner-clients-table";

export default async function PartnerClientsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [partner, scope] = await Promise.all([
    getPartnerBySlug(slug),
    resolveAuthorizedScope(),
  ]);
  if (!partner) notFound();

  const isPlatformAdmin = scope.isPlatformAdmin;

  const [clients, unassignedClients] = await Promise.all([
    getPartnerClients(partner.id),
    isPlatformAdmin ? getUnassignedClients() : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-section">Clients</h2>
        <p className="text-caption mt-0.5">
          {clients.length} client{clients.length !== 1 ? "s" : ""} in this partner&apos;s portfolio.
        </p>
      </div>
      <PartnerClientsTable
        clients={clients}
        partnerId={partner.id}
        isPlatformAdmin={isPlatformAdmin}
        unassignedClients={unassignedClients}
      />
    </div>
  );
}
