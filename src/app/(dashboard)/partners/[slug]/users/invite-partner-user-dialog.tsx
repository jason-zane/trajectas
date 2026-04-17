"use client";

import { inviteUserToPartner } from "@/app/actions/partners";
import { InviteMemberDialog } from "@/components/invite-member-dialog";

interface InvitePartnerUserDialogProps {
  partnerId: string;
}

export function InvitePartnerUserDialog({ partnerId }: InvitePartnerUserDialogProps) {
  return (
    <InviteMemberDialog
      scope="partner workspace"
      onInvite={(params) => inviteUserToPartner(partnerId, params)}
    />
  );
}
