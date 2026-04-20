import { redirect } from "next/navigation";
import { canManageClient, resolveAuthorizedScope } from "@/lib/auth/authorization";
import { resolveClientOrg } from "@/lib/auth/resolve-client-org";
import { ClientTeamPanel } from "@/components/client-team-panel";

export default async function ClientPortalTeamPage() {
  const [{ clientId }, scope] = await Promise.all([
    resolveClientOrg("/client/settings/team"),
    resolveAuthorizedScope(),
  ]);

  if (!clientId) {
    redirect("/client/dashboard");
  }

  if (!canManageClient(scope, clientId)) {
    redirect("/unauthorized?reason=permission");
  }

  return <ClientTeamPanel clientId={clientId} />;
}
