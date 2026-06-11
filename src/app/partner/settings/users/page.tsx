import { notFound } from "next/navigation";
import {
  canManagePartner,
  resolveAuthorizedScope,
} from "@/lib/auth/authorization";
import {
  getPartnerMembers,
  getPartnerPendingInvites,
} from "@/app/actions/partners";
import { resolvePartnerOrg } from "@/lib/auth/resolve-partner-org";
import { PartnerPortalUsersTable } from "./partner-users-table";
import { PartnerPortalInviteDialog } from "./invite-partner-user-dialog";
import { PartnerPortalPendingInvites } from "./partner-pending-invites-section";
import { WorkspaceUsersPage } from "@/components/workspace-users/workspace-users-page";

export default async function PartnerPortalUsersPage() {
  const [{ partnerId }, scope] = await Promise.all([
    resolvePartnerOrg("/partner/settings/users"),
    resolveAuthorizedScope(),
  ]);

  if (!partnerId) notFound();

  if (!canManagePartner(scope, partnerId)) {
    notFound();
  }

  const [members, pendingInvites] = await Promise.all([
    getPartnerMembers(partnerId),
    getPartnerPendingInvites(partnerId),
  ]);

  return (
    <WorkspaceUsersPage
      surface={{
        workspaceId: partnerId,
        TableComponent: PartnerPortalUsersTable,
        InviteDialog: PartnerPortalInviteDialog,
        PendingInvitesComponent: PartnerPortalPendingInvites,
        members,
        pendingInvites,
      }}
    />
  );
}
