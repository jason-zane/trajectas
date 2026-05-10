import { notFound } from "next/navigation";
import {
  getPartnerMembers,
  getPartnerPendingInvites,
} from "@/app/actions/partners";
import { resolvePartnerOrg } from "@/lib/auth/resolve-partner-org";
import { PartnerPortalUsersTable } from "./partner-users-table";
import { PartnerPortalInviteDialog } from "./invite-partner-user-dialog";
import { PartnerPortalPendingInvites } from "./partner-pending-invites-section";

export default async function PartnerPortalUsersPage() {
  const { partnerId } = await resolvePartnerOrg("/partner/settings/users");
  if (!partnerId) notFound();

  const [members, pendingInvites] = await Promise.all([
    getPartnerMembers(partnerId),
    getPartnerPendingInvites(partnerId),
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
        <PartnerPortalInviteDialog partnerId={partnerId} />
      </div>

      <PartnerPortalUsersTable partnerId={partnerId} members={members} />

      {pendingInvites.length > 0 && (
        <PartnerPortalPendingInvites
          partnerId={partnerId}
          invites={pendingInvites}
        />
      )}
    </div>
  );
}
