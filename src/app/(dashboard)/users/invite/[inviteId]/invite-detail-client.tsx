"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { InviteDetail } from "@/app/actions/user-management";
import { resendInvite } from "@/app/actions/user-management";
import { revokeInviteById } from "@/app/actions/staff-users";

interface InviteDetailClientProps {
  invite: InviteDetail;
}

export function InviteDetailClient({ invite }: InviteDetailClientProps) {
  const router = useRouter();
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [isResending, startResend] = useTransition();
  const [isRevoking, startRevoke] = useTransition();

  function handleResend() {
    startResend(async () => {
      const result = await resendInvite(invite.id);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success(`Invite email resent to ${invite.email}`);
      router.refresh();
    });
  }

  function handleRevoke() {
    startRevoke(async () => {
      const result = await revokeInviteById(invite.id);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Invite revoked");
      setRevokeOpen(false);
      router.push("/users");
      router.refresh();
    });
  }

  const isPending = !invite.acceptedAt && !invite.revokedAt;

  return (
    <div className="flex flex-wrap gap-3 pt-2">
      <Button
        type="button"
        onClick={handleResend}
        disabled={!isPending || isResending}
      >
        <RefreshCw className="size-4" />
        {isResending ? "Resending..." : "Resend Invite"}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => setRevokeOpen(true)}
        disabled={!isPending || isRevoking}
        className="text-destructive hover:text-destructive"
      >
        <X className="size-4" />
        Revoke Invite
      </Button>
      <ConfirmDialog
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        title="Revoke Invite"
        description={`This will cancel the pending invite for ${invite.email}. They will no longer be able to accept it.`}
        confirmLabel="Revoke"
        variant="destructive"
        onConfirm={handleRevoke}
        loading={isRevoking}
      />
    </div>
  );
}
