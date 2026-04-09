import { notFound } from "next/navigation";
import { WorkspacePortalLivePage } from "@/components/workspace-portal-live";
import { WorkspacePortalPage } from "@/components/workspace-portal-page";
import { resolveWorkspaceAccess } from "@/lib/auth/workspace-access";
import {
  clientPortalPages,
  resolveWorkspacePortalPageConfig,
} from "@/lib/workspace-portal-config";
import { getWorkspaceRequestContext } from "@/lib/workspace-request";

export default async function ClientDiagnosticDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const config = resolveWorkspacePortalPageConfig(
    clientPortalPages,
    `diagnostics/${id}`
  );

  if (!config) {
    notFound();
  }

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
