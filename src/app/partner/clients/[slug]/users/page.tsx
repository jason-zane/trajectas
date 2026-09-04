import { getClientMembers, getClientPendingInvites } from "@/app/actions/clients";
import { ClientPortalUsersTable } from "@/app/client/settings/users/client-users-table";
import { ClientPortalInviteDialog } from "@/app/client/settings/users/invite-user-dialog";
import { ClientPortalPendingInvites } from "@/app/client/settings/users/pending-invites-section";
import { WorkspaceUsersPage } from "@/components/workspace-users/workspace-users-page";
import { requirePartnerClient } from "@/lib/auth/resolve-partner-client";

export default async function PartnerClientUsersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { client } = await requirePartnerClient(slug);

  const [members, pendingInvites] = await Promise.all([
    getClientMembers(client.id),
    getClientPendingInvites(client.id),
  ]);

  return (
    <WorkspaceUsersPage
      surface={{
        workspaceId: client.id,
        // The client-portal components: no links into the admin user directory.
        TableComponent: ClientPortalUsersTable,
        InviteDialog: ClientPortalInviteDialog,
        PendingInvitesComponent: ClientPortalPendingInvites,
        members,
        pendingInvites,
      }}
    />
  );
}
