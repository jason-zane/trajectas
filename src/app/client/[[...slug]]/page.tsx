import { notFound, redirect } from "next/navigation";
import { WorkspacePortalLivePage } from "@/components/workspace-portal-live";
import { WorkspacePortalPage } from "@/components/workspace-portal-page";
import { resolveWorkspaceAccess } from "@/lib/auth/workspace-access";
import {
  clientPortalPages,
  resolveWorkspacePortalPageConfig,
} from "@/lib/workspace-portal-config";
import { getWorkspaceRequestContext } from "@/lib/workspace-request";

export default async function ClientPortalPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const key = slug?.join("/") ?? "";

  // Root /client path → redirect to dashboard
  if (key === "") {
    redirect("/client/dashboard");
  }

  const config = resolveWorkspacePortalPageConfig(clientPortalPages, key);

  if (!config) {
    notFound();
  }

  const [access, requestContext] = await Promise.all([
    resolveWorkspaceAccess("client"),
    getWorkspaceRequestContext("client"),
  ]);

  if (access.status === "signed_out") {
    redirect(`/login?next=${encodeURIComponent(`/client/${key}`.replace(/\/+$/, "") || "/client")}`);
  }

  if (access.status === "ok") {
    return (
      <WorkspacePortalLivePage
        access={access}
        config={config}
        routePrefix={requestContext.routePrefix}
        surface="client"
        pageKey={key}
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
