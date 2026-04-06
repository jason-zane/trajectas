import { redirect } from "next/navigation";
import { ClientCreateForm } from "./client-create-form";
import {
  AuthorizationError,
  canManageClientAssignment,
  canManageClientDirectory,
  getPreferredPartnerIdForClientCreation,
  resolveAuthorizedScope,
} from "@/lib/auth/authorization";
import { getAssignablePartners } from "@/app/actions/partners";

export default async function CreateClientPage() {
  const scope = await resolveAuthorizedScope();

  if (!canManageClientDirectory(scope)) {
    redirect("/unauthorized?reason=client-directory");
  }

  const canAssignPartner = canManageClientAssignment(scope);
  const partners = canAssignPartner ? await getAssignablePartners() : [];

  let fixedPartnerId: string | null = null;

  if (!canAssignPartner) {
    try {
      fixedPartnerId = getPreferredPartnerIdForClientCreation(scope);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        redirect("/unauthorized?reason=client-directory");
      }
      throw error;
    }
  }

  return (
    <ClientCreateForm
      partnerOptions={partners.map((partner) => ({
        id: partner.id,
        name: partner.name,
      }))}
      canAssignPartner={canAssignPartner}
      fixedPartnerId={fixedPartnerId}
    />
  );
}
