import { notFound } from "next/navigation";
import {
  getClientMembers,
  getClientPendingInvites,
} from "@/app/actions/clients";
import { resolveClientOrg } from "@/lib/auth/resolve-client-org";
import { ClientPortalUsersTable } from "./client-users-table";
import { ClientPortalInviteDialog } from "./invite-user-dialog";
import { ClientPortalPendingInvites } from "./pending-invites-section";

export default async function ClientPortalUsersPage() {
  const { clientId } = await resolveClientOrg("/client/settings/users");
  if (!clientId) notFound();

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
            Invite, promote, and remove people from your workspace.
          </p>
        </div>
        <ClientPortalInviteDialog clientId={clientId} />
      </div>

      <ClientPortalUsersTable clientId={clientId} members={members} />

      {pendingInvites.length > 0 && (
        <ClientPortalPendingInvites
          clientId={clientId}
          invites={pendingInvites}
        />
      )}
    </div>
  );
}
