import { WorkspacePortalLivePage } from "@/components/workspace-portal-live";
import { WorkspacePortalPage } from "@/components/workspace-portal-page";
import { resolveWorkspaceAccess } from "@/lib/auth/workspace-access";
import { clientPortalPages } from "@/lib/workspace-portal-config";
import { getWorkspaceRequestContext } from "@/lib/workspace-request";

export default async function ClientDiagnosticResultDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const config = clientPortalPages["diagnostic-results"];

  const [access, requestContext] = await Promise.all([
    resolveWorkspaceAccess("client"),
    getWorkspaceRequestContext("client"),
  ]);

  if (access.status === "ok") {
    return (
      <WorkspacePortalLivePage
        access={access}
        config={config}
        routePrefix={requestContext.routePrefix}
        surface="client"
        pageKey={`diagnostic-results/${id}`}
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
