import {
  getClientMembers,
  getClientPendingInvites,
} from "@/app/actions/clients";
import { ClientUsersTable } from "@/app/(dashboard)/clients/[slug]/users/client-users-table";
import { InviteUserDialog } from "@/app/(dashboard)/clients/[slug]/users/invite-user-dialog";
import { PendingInvitesSection } from "@/app/(dashboard)/clients/[slug]/users/pending-invites-section";

interface ClientTeamPanelProps {
  clientId: string;
  userProfileHref?: (userId: string) => string;
}

export async function ClientTeamPanel({
  clientId,
  userProfileHref,
}: ClientTeamPanelProps) {
  const [members, pendingInvites] = await Promise.all([
    getClientMembers(clientId),
    getClientPendingInvites(clientId),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-section">Team Members</h2>
          <p className="text-caption mt-0.5">
            Manage who has access to this client workspace.
          </p>
        </div>
        <InviteUserDialog clientId={clientId} />
      </div>

      <ClientUsersTable
        clientId={clientId}
        members={members}
        userProfileHref={userProfileHref}
      />

      {pendingInvites.length > 0 && (
        <PendingInvitesSection clientId={clientId} invites={pendingInvites} />
      )}
    </div>
  );
}
