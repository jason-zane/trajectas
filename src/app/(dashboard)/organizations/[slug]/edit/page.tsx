import { notFound, redirect } from "next/navigation";
import { getAssignablePartners } from "@/app/actions/partners";
import { getOrganizationBySlug } from "@/app/actions/organizations";
import {
  canManageClient,
  canManageClientAssignment,
  resolveAuthorizedScope,
} from "@/lib/auth/authorization";
import { buildSurfaceUrl } from "@/lib/hosts";
import { getWorkspaceRequestContext } from "@/lib/workspace-request";
import { OrganizationEditForm } from "./organization-edit-form";

export default async function EditOrganizationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [organization, scope, requestContext] = await Promise.all([
    getOrganizationBySlug(slug, { includeArchived: true }),
    resolveAuthorizedScope(),
    getWorkspaceRequestContext("client"),
  ]);
  if (!organization) notFound();
  if (!canManageClient(scope, organization.id)) {
    redirect("/unauthorized?reason=client-directory");
  }

  const canAssignPartner = canManageClientAssignment(scope);
  const partners = canAssignPartner ? await getAssignablePartners() : [];

  const clientLaunchEndpoint = requestContext.isLocalDev
    ? "/client/support/launch"
    : buildSurfaceUrl("client", "/support/launch")?.toString() ?? null;
  const clientLaunchNextPath = requestContext.isLocalDev ? "/client" : "/";

  return (
    <OrganizationEditForm
      organization={organization}
      partnerOptions={partners.map((partner) => ({
        id: partner.id,
        name: partner.name,
      }))}
      canAssignPartner={canAssignPartner}
      canLaunchClientPortal={scope.isPlatformAdmin && Boolean(scope.actor)}
      clientLaunchEndpoint={clientLaunchEndpoint}
      clientLaunchNextPath={clientLaunchNextPath}
    />
  );
}
