"use client";

import { WorkspaceTeamControls } from '@/components/workspace-team-controls'

import { inviteUserToPartner } from "@/app/actions/partners";
import { InviteMemberDialog } from "@/components/invite-member-dialog";

export function PartnerPortalInviteDialog({ workspaceId }: { workspaceId: string }) {
  return (
    <WorkspaceTeamControls clientScope={false}><InviteMemberDialog
      scope="partner workspace"
      onInvite={(params) => inviteUserToPartner(workspaceId, params)}
    /></WorkspaceTeamControls>
  );
}
