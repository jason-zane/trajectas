"use client";

import { WorkspaceTeamControls } from '@/components/workspace-team-controls'

import { inviteUserToClient } from "@/app/actions/clients";
import { InviteMemberDialog } from "@/components/invite-member-dialog";

interface InviteUserDialogProps {
  clientId: string;
}

export function InviteUserDialog({ clientId }: InviteUserDialogProps) {
  return (
    <WorkspaceTeamControls clientScope={true}><InviteMemberDialog
      scope="client workspace"
      onInvite={(params) => inviteUserToClient(clientId, params)}
    /></WorkspaceTeamControls>
  );
}
