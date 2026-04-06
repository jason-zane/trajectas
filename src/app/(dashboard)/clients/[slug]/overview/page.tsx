import { notFound, redirect } from "next/navigation";
import { getAssignablePartners } from "@/app/actions/partners";
import { getClientBySlug } from "@/app/actions/clients";
import {
  canManageClient,
  canManageClientAssignment,
  resolveAuthorizedScope,
} from "@/lib/auth/authorization";
import { ClientEditForm } from "./client-edit-form";

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
  if (!canManageClient(scope, client.id)) {
    redirect("/unauthorized?reason=client-directory");
  }

  const canAssignPartner = canManageClientAssignment(scope);
  const partners = canAssignPartner ? await getAssignablePartners() : [];

  return (
    <ClientEditForm
      client={client}
      partnerOptions={partners.map((partner) => ({
        id: partner.id,
        name: partner.name,
      }))}
      canAssignPartner={canAssignPartner}
    />
  );
}
