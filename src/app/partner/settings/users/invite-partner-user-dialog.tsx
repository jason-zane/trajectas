"use client";

import { inviteUserToPartner } from "@/app/actions/partners";
import { InviteMemberDialog } from "@/components/invite-member-dialog";

export function PartnerPortalInviteDialog({ partnerId }: { partnerId: string }) {
  return (
    <InviteMemberDialog
      scope="partner workspace"
      onInvite={(params) => inviteUserToPartner(partnerId, params)}
    />
  );
}
