import { notFound } from "next/navigation";
import {
  getClientBySlug,
  getClientMembers,
  getClientPendingInvites,
} from "@/app/actions/clients";
import { ClientUsersTable } from "./client-users-table";
import { InviteUserDialog } from "./invite-user-dialog";
import { PendingInvitesSection } from "./pending-invites-section";

export default async function ClientUsersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = await getClientBySlug(slug);
  if (!client) notFound();

  const [members, pendingInvites] = await Promise.all([
    getClientMembers(client.id),
    getClientPendingInvites(client.id),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-section">Team Members</h2>
          <p className="text-caption mt-0.5">
            Manage who has access to this client workspace.
          </p>
        </div>
        <InviteUserDialog clientId={client.id} />
      </div>

      {/* Members table */}
      <ClientUsersTable clientId={client.id} members={members} />

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <PendingInvitesSection
          clientId={client.id}
          invites={pendingInvites}
        />
      )}
    </div>
  );
}
