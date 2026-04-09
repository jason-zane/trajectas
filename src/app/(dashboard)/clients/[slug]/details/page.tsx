import { notFound, redirect } from "next/navigation";
import { getClientBySlug } from "@/app/actions/clients";
import { getAssignablePartners } from "@/app/actions/partners";
import {
  canManageClient,
  canManageClientAssignment,
  resolveAuthorizedScope,
} from "@/lib/auth/authorization";
import { ClientDetailsForm } from "./client-details-form";

export default async function ClientDetailsPage({
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
  const partnerOptions = canAssignPartner
    ? (await getAssignablePartners()).map((p) => ({ id: p.id, name: p.name }))
    : [];

  return (
    <ClientDetailsForm
      client={client}
      partnerOptions={partnerOptions}
      canAssignPartner={canAssignPartner}
    />
  );
}
