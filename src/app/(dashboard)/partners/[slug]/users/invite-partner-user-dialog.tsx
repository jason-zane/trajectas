"use client";

import { WorkspaceTeamControls } from '@/components/workspace-team-controls'

import { inviteUserToPartner } from "@/app/actions/partners";
import { InviteMemberDialog } from "@/components/invite-member-dialog";

interface InvitePartnerUserDialogProps {
  partnerId: string;
}

export function InvitePartnerUserDialog({ partnerId }: InvitePartnerUserDialogProps) {
  return (
    <WorkspaceTeamControls clientScope={false}><InviteMemberDialog
      scope="partner workspace"
      onInvite={(params) => inviteUserToPartner(partnerId, params)}
    /></WorkspaceTeamControls>
  );
}
