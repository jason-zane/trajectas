"use client";

import { inviteUserToClient } from "@/app/actions/clients";
import { InviteMemberDialog } from "@/components/invite-member-dialog";

export function ClientPortalInviteDialog({ workspaceId }: { workspaceId: string }) {
  return (
    <InviteMemberDialog
      scope="client workspace"
      onInvite={(params) => inviteUserToClient(workspaceId, params)}
    />
  );
}
