import { WorkspacePortalLivePage } from "@/components/workspace-portal-live";
import { WorkspacePortalPage } from "@/components/workspace-portal-page";
import { resolveWorkspaceAccess } from "@/lib/auth/workspace-access";
import { partnerPortalPages } from "@/lib/workspace-portal-config";
import { getWorkspaceRequestContext } from "@/lib/workspace-request";

export default async function PartnerDiagnosticDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const config = partnerPortalPages.diagnostics;

  const [access, requestContext] = await Promise.all([
    resolveWorkspaceAccess("partner"),
    getWorkspaceRequestContext("partner"),
  ]);

  if (access.status === "ok") {
    return (
      <WorkspacePortalLivePage
        access={access}
        config={config}
        routePrefix={requestContext.routePrefix}
        surface="partner"
        pageKey={`diagnostics/${id}`}
      />
    );
  }

  return (
    <WorkspacePortalPage
      access={access}
      config={config}
      routePrefix={requestContext.routePrefix}
    />
  );
}
