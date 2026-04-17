"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Send } from "lucide-react";

import {
  ActionDialog,
  ActionDialogBody,
  ActionDialogFooter,
} from "@/components/action-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSelectLabel } from "@/lib/select-display";

type MembershipRole = "admin" | "member";

type InviteResult = { error?: string } | void;

interface InviteMemberDialogProps {
  /** Descriptive workspace label, e.g. "client workspace" or "partner workspace". */
  scope: string;
  /** Server action that sends the invite. Should return `{ error }` on failure. */
  onInvite: (params: { email: string; role: MembershipRole }) => Promise<InviteResult>;
  triggerLabel?: string;
  eyebrow?: string;
}

const membershipRoleOptions = [
  { value: "member", label: "Member" },
  { value: "admin", label: "Admin" },
] as const;

export function InviteMemberDialog({
  scope,
  onInvite,
  triggerLabel = "Invite user",
  eyebrow = "Team",
}: InviteMemberDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MembershipRole>("member");
  const [error, setError] = useState<string | null>(null);
  const [isInviting, startInvite] = useTransition();

  function resetForm() {
    setEmail("");
    setRole("member");
    setError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) resetForm();
  }

  function handleInvite() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Email is required");
      return;
    }
    setError(null);

    startInvite(async () => {
      const result = await onInvite({ email: trimmedEmail, role });

      if (result && "error" in result && result.error) {
        setError(result.error);
        toast.error(result.error);
        return;
      }

      toast.success(`Invite sent to ${trimmedEmail}`);
      setOpen(false);
      resetForm();
      router.refresh();
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus data-icon="inline-start" />
        {triggerLabel}
      </Button>

      <ActionDialog
        open={open}
        onOpenChange={handleOpenChange}
        eyebrow={eyebrow}
        title="Invite team member"
        description={`Send an invite to join this ${scope}. The invite expires in 7 days.`}
      >
        <ActionDialogBody className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email address</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleInvite();
                }
              }}
              aria-invalid={error ? true : undefined}
              disabled={isInviting}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <Select
              value={role}
              onValueChange={(val) => setRole(val as MembershipRole)}
              disabled={isInviting}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value: string | null) =>
                    getSelectLabel(value as MembershipRole | null, membershipRoleOptions)
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <p className="text-caption">
              Admins can manage team members and settings. Members have standard access.
            </p>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </ActionDialogBody>
        <ActionDialogFooter>
          <Button
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={isInviting}
          >
            Cancel
          </Button>
          <Button onClick={handleInvite} disabled={isInviting || !email.trim()}>
            <Send className="size-4" />
            {isInviting ? "Sending..." : "Send invite"}
          </Button>
        </ActionDialogFooter>
      </ActionDialog>
    </>
  );
}
