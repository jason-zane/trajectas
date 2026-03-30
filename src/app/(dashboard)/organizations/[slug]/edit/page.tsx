import { notFound } from "next/navigation";
import { getOrganizationBySlug } from "@/app/actions/organizations";
import { resolveAuthorizedScope } from "@/lib/auth/authorization";
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
    getOrganizationBySlug(slug),
    resolveAuthorizedScope(),
    getWorkspaceRequestContext("client"),
  ]);
  if (!organization) notFound();

  const clientLaunchEndpoint = requestContext.isLocalDev
    ? "/client/support/launch"
    : buildSurfaceUrl("client", "/support/launch")?.toString() ?? null;
  const clientLaunchNextPath = requestContext.isLocalDev ? "/client" : "/";

  return (
    <OrganizationEditForm
      organization={organization}
      canLaunchClientPortal={scope.isPlatformAdmin && Boolean(scope.actor)}
      clientLaunchEndpoint={clientLaunchEndpoint}
      clientLaunchNextPath={clientLaunchNextPath}
    />
  );
}
