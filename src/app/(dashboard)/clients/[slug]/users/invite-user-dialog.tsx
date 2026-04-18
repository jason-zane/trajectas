"use client";

import { inviteUserToClient } from "@/app/actions/clients";
import { InviteMemberDialog } from "@/components/invite-member-dialog";

interface InviteUserDialogProps {
  clientId: string;
}

export function InviteUserDialog({ clientId }: InviteUserDialogProps) {
  return (
    <InviteMemberDialog
      scope="client workspace"
      onInvite={(params) => inviteUserToClient(clientId, params)}
    />
  );
}
