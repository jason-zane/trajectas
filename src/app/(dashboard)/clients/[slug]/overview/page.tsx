import { notFound, redirect } from "next/navigation";
import { getAssignablePartners } from "@/app/actions/partners";
import { getClientBySlug, getClientStats } from "@/app/actions/clients";
import {
  canManageClient,
  canManageClientAssignment,
  resolveAuthorizedScope,
} from "@/lib/auth/authorization";
import { ClientEditForm } from "./client-edit-form";
import { ClientOverview } from "./client-overview";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [client, scope] = await Promise.all([
    getClientBySlug(slug, { includeArchived: true }),
    resolveAuthorizedScope(),
  ]);
  if (!client) notFound();
  if (!canManageClient(scope, client.id, client.partnerId)) {
    redirect("/unauthorized?reason=client-directory");
  }

  const canAssignPartner = canManageClientAssignment(scope);
  const [partners, stats] = await Promise.all([
    canAssignPartner ? getAssignablePartners() : Promise.resolve([]),
    getClientStats(client.id),
  ]);

  return (
    <ClientOverview
      client={{ id: client.id, name: client.name, slug: client.slug }}
      stats={stats}
    >
      <ClientEditForm
        client={client}
        partnerOptions={partners.map((partner) => ({
          id: partner.id,
          name: partner.name,
        }))}
        canAssignPartner={canAssignPartner}
      />
    </ClientOverview>
  );
}
