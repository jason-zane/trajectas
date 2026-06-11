import { notFound } from "next/navigation";
import {
  canManageClient,
  resolveAuthorizedScope,
} from "@/lib/auth/authorization";
import {
  getClientMembers,
  getClientPendingInvites,
} from "@/app/actions/clients";
import { resolveClientOrg } from "@/lib/auth/resolve-client-org";
import { ClientPortalUsersTable } from "./client-users-table";
import { ClientPortalInviteDialog } from "./invite-user-dialog";
import { ClientPortalPendingInvites } from "./pending-invites-section";
import { WorkspaceUsersPage } from "@/components/workspace-users/workspace-users-page";

export default async function ClientPortalUsersPage() {
  const [{ clientId }, scope] = await Promise.all([
    resolveClientOrg("/client/settings/users"),
    resolveAuthorizedScope(),
  ]);

  if (!clientId) notFound();

  if (!canManageClient(scope, clientId)) {
    notFound();
  }

  const [members, pendingInvites] = await Promise.all([
    getClientMembers(clientId),
    getClientPendingInvites(clientId),
  ]);

  return (
    <WorkspaceUsersPage
      surface={{
        workspaceId: clientId,
        TableComponent: ClientPortalUsersTable,
        InviteDialog: ClientPortalInviteDialog,
        PendingInvitesComponent: ClientPortalPendingInvites,
        members,
        pendingInvites,
      }}
    />
  );
}
