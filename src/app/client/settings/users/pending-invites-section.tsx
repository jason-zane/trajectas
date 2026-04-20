"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X } from "lucide-react";

import {
  revokeClientInvite,
  type ClientPendingInvite,
} from "@/app/actions/clients";
import { Button } from "@/components/ui/button";
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatRole(role: string) {
  if (role === "client_admin") return "Admin";
  if (role === "client_member") return "Member";
  const short = role.replace(/^client_/, "");
  return short.charAt(0).toUpperCase() + short.slice(1);
}

export function ClientPortalPendingInvites({
  clientId,
  invites,
}: {
  clientId: string;
  invites: ClientPendingInvite[];
}) {
  const router = useRouter();
  const [revokeTarget, setRevokeTarget] = useState<ClientPendingInvite | null>(
    null,
  );
  const [isRevoking, startRevoke] = useTransition();

  function handleRevoke() {
    if (!revokeTarget) return;
    startRevoke(async () => {
      const result = await revokeClientInvite(clientId, revokeTarget.id);
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
    <div className="space-y-3">
      <h3 className="text-section">Pending invites</h3>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Invited</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {invites.map((invite) => (
              <TableRow key={invite.id}>
                <TableCell className="font-medium">{invite.email}</TableCell>
                <TableCell>
                  <Badge variant="outline">{formatRole(invite.role)}</Badge>
                </TableCell>
                <TableCell className="text-caption tabular-nums">
                  {formatDate(invite.createdAt)}
                </TableCell>
                <TableCell className="text-caption tabular-nums">
                  {formatDate(invite.expiresAt)}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setRevokeTarget(invite)}
                    aria-label="Revoke invite"
                    className="text-destructive hover:text-destructive"
                  >
                    <X />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <ConfirmDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
        title="Revoke invite"
        description={`This cancels the pending invite for ${
          revokeTarget?.email ?? "this user"
        }. They will no longer be able to accept it.`}
        confirmLabel="Revoke"
        variant="destructive"
        onConfirm={handleRevoke}
        loading={isRevoking}
      />
    </div>
  );
}
