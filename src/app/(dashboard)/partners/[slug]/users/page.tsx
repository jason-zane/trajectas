import { notFound } from "next/navigation";
import {
  getPartnerBySlug,
  getPartnerMembers,
  getPartnerPendingInvites,
} from "@/app/actions/partners";
import { PartnerUsersTable } from "./partner-users-table";
import { InvitePartnerUserDialog } from "./invite-partner-user-dialog";
import { PartnerPendingInvitesSection } from "./partner-pending-invites-section";

export default async function PartnerUsersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const partner = await getPartnerBySlug(slug);
  if (!partner) notFound();

  const [members, pendingInvites] = await Promise.all([
    getPartnerMembers(partner.id),
    getPartnerPendingInvites(partner.id),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-section">Team Members</h2>
          <p className="text-caption mt-0.5">
            Manage who has access to this partner workspace.
          </p>
        </div>
        <InvitePartnerUserDialog partnerId={partner.id} />
      </div>

      {/* Members table */}
      <PartnerUsersTable partnerId={partner.id} members={members} />

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <PartnerPendingInvitesSection
          partnerId={partner.id}
          invites={pendingInvites}
        />
      )}
    </div>
  );
}
