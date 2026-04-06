"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserX, Users } from "lucide-react";

import {
  changePartnerMemberRole,
  removePartnerMember,
  type PartnerMember,
} from "@/app/actions/partners";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState } from "react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PartnerUsersTableProps {
  partnerId: string;
  members: PartnerMember[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMemberName(member: PartnerMember) {
  const parts = [member.firstName, member.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PartnerUsersTable({ partnerId, members }: PartnerUsersTableProps) {
  const router = useRouter();
  const [removeTarget, setRemoveTarget] = useState<PartnerMember | null>(null);
  const [isRemoving, startRemove] = useTransition();
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);

  function handleRoleChange(member: PartnerMember, newRole: string) {
    const role = newRole as "admin" | "member";
    if (role === member.role) return;

    setChangingRoleId(member.membershipId);

    startRemove(async () => {
      const result = await changePartnerMemberRole(
        partnerId,
        member.membershipId,
        role
      );

      setChangingRoleId(null);

      if (result && "error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success(`Role updated to ${role}`);
      router.refresh();
    });
  }

  function handleRemove() {
    if (!removeTarget) return;

    startRemove(async () => {
      const result = await removePartnerMember(
        partnerId,
        removeTarget.membershipId
      );

      if (result && "error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Member removed");
      setRemoveTarget(null);
      router.refresh();
    });
  }

  // Empty state
  if (members.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Users className="mx-auto size-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            No team members yet. Invite someone to get started.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              const displayName = formatMemberName(member);
              return (
                <TableRow key={member.membershipId}>
                  <TableCell className="font-medium">
                    {displayName ?? (
                      <span className="text-muted-foreground italic">
                        No name
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {member.email}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={member.role}
                      onValueChange={(val) =>
                        handleRoleChange(member, val as string)
                      }
                      disabled={changingRoleId === member.membershipId}
                    >
                      <SelectTrigger size="sm" className="w-[110px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-caption tabular-nums">
                    {formatDate(member.addedAt)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setRemoveTarget(member)}
                      aria-label="Remove member"
                      className="text-destructive hover:text-destructive"
                    >
                      <UserX />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Remove confirmation */}
      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
        title="Remove Team Member"
        description={`This will revoke ${formatMemberName(removeTarget!) ?? removeTarget?.email ?? "this user"}'s access to this partner workspace. They can be re-invited later.`}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={handleRemove}
        loading={isRemoving}
      />
    </>
  );
}
