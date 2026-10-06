"use client";

import { WorkspaceTeamControls } from '@/components/workspace-team-controls'

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X } from "lucide-react";

import {
  reissuePartnerInvite,
  revokePartnerInvite,
  type PartnerPendingInvite,
} from "@/app/actions/partners";
import { Button } from "@/components/ui/button";
import { CopyInviteLinkButton } from "@/components/copy-invite-link-button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/formatting";
import { getInviteStatus } from "@/lib/invite-status";
import { OutstandingInvitesHeader } from "@/components/workspace-users/outstanding-invites-header";
import { EmptyState } from "@/components/empty-state";
import { useOutstandingInviteFilter } from "@/components/workspace-users/use-outstanding-invite-filter";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PartnerPendingInvitesSectionProps {
  partnerId: string;
  invites: PartnerPendingInvite[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRoleLabel(role: string) {
  if (role === "partner_admin") return "Admin";
  if (role === "partner_member") return "Member";
  // Fallback: strip prefix and capitalize
  const short = role.replace(/^partner_/, "");
  return short.charAt(0).toUpperCase() + short.slice(1);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PartnerPendingInvitesSection({
  partnerId,
  invites,
}: PartnerPendingInvitesSectionProps) {
  const router = useRouter();
  const [filter, setFilter] = useOutstandingInviteFilter();
  const visibleInvites = invites.filter(invite => filter === "all" || getInviteStatus(invite) === filter);
  const [revokeTarget, setRevokeTarget] = useState<PartnerPendingInvite | null>(
    null
  );
  const [isRevoking, startRevoke] = useTransition();

  function handleRevoke() {
    if (!revokeTarget) return;

    startRevoke(async () => {
      const result = await revokePartnerInvite(partnerId, revokeTarget.id);

      if (result && "error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Invite revoked");
      setRevokeTarget(null);
      router.refresh();
    });
  }

  return (
    <div id="outstanding-invites" className="space-y-3 scroll-mt-6">
      <OutstandingInvitesHeader invites={invites} filter={filter} onFilterChange={setFilter} />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Invited</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead className="w-[112px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleInvites.map((invite) => (
              <TableRow key={invite.id} id={`invite-${invite.id}`}>
                <TableCell className="font-medium">{invite.email}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {formatRoleLabel(invite.role)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {getInviteStatus(invite) === "expired" ? "Expired" : "Pending"}
                  </Badge>
                </TableCell>
                <TableCell className="text-caption tabular-nums">
                  {formatDate(invite.createdAt)}
                </TableCell>
                <TableCell className="text-caption tabular-nums">
                  {formatDate(invite.expiresAt)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <WorkspaceTeamControls clientScope={false}><CopyInviteLinkButton
                      iconOnly
                      email={invite.email}
                      label="Copy invite link"
                      onClose={() => {
                        setFilter("all");
                        router.refresh();
                      }}
                      getLink={() => reissuePartnerInvite(partnerId, invite.id)}
                    /></WorkspaceTeamControls>
                    <WorkspaceTeamControls clientScope={false}><Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setRevokeTarget(invite)}
                      aria-label="Revoke invite"
                      className="text-destructive hover:text-destructive"
                    >
                      <X />
                    </Button></WorkspaceTeamControls>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {visibleInvites.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <EmptyState
                    size="sm"
                    title={`No ${filter === "all" ? "outstanding" : filter} invitations`}
                    description="Choose All to view every outstanding invitation in this workspace."
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Revoke confirmation */}
      <ConfirmDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
        title="Revoke Invite"
        description={`This will cancel the pending invite for ${revokeTarget?.email ?? "this user"}. They will no longer be able to accept it.`}
        confirmLabel="Revoke"
        variant="destructive"
        onConfirm={handleRevoke}
        loading={isRevoking}
      />
    </div>
  );
}
