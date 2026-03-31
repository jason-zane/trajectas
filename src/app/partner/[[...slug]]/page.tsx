import { notFound, redirect } from "next/navigation";
import { WorkspacePortalLivePage } from "@/components/workspace-portal-live";
import { WorkspacePortalPage } from "@/components/workspace-portal-page";
import { resolveWorkspaceAccess } from "@/lib/auth/workspace-access";
import {
  partnerPortalPages,
  resolveWorkspacePortalPageConfig,
} from "@/lib/workspace-portal-config";
import { getWorkspaceRequestContext } from "@/lib/workspace-request";

export default async function PartnerPortalPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const key = slug?.join("/") ?? "";
  const config = resolveWorkspacePortalPageConfig(partnerPortalPages, key);

  if (!config) {
    notFound();
  }

  const [access, requestContext] = await Promise.all([
    resolveWorkspaceAccess("partner"),
    getWorkspaceRequestContext("partner"),
  ]);

  if (access.status === "signed_out") {
    redirect(`/login?next=${encodeURIComponent(`/partner/${key}`.replace(/\/+$/, "") || "/partner")}`);
  }

  if (access.status === "ok") {
    return (
      <WorkspacePortalLivePage
        access={access}
        config={config}
        routePrefix={requestContext.routePrefix}
        surface="partner"
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
