"use client";

import { WorkspaceTeamControls } from '@/components/workspace-team-controls'

import { inviteUserToClient } from "@/app/actions/clients";
import { InviteMemberDialog } from "@/components/invite-member-dialog";

export function ClientPortalInviteDialog({ workspaceId }: { workspaceId: string }) {
  return (
    <WorkspaceTeamControls clientScope={true}><InviteMemberDialog
      scope="client workspace"
      onInvite={(params) => inviteUserToClient(workspaceId, params)}
    /></WorkspaceTeamControls>
  );
}
