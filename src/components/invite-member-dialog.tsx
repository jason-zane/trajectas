"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Plus, Send } from "lucide-react";

import {
  ActionDialog,
  ActionDialogBody,
  ActionDialogFooter,
} from "@/components/action-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InviteLinkField } from "@/components/invite-link-field";
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

type InviteResult =
  | { error?: string; inviteLink?: string; emailDelivered?: boolean }
  | void;

interface InviteMemberDialogProps {
  /** Descriptive workspace label, e.g. "client workspace" or "partner workspace". */
  scope: string;
  /**
   * Server action that sends the invite. Returns `{ error }` on failure, or
   * `{ inviteLink }` on success so the link can be copied and shared directly.
   */
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
  // When set, the invite was created and we show the shareable link instead of
  // the form so the admin can copy it (email is sent too, but may not arrive).
  const [sent, setSent] = useState<{
    email: string;
    link: string | null;
    delivered: boolean;
  } | null>(null);

  function resetForm() {
    setEmail("");
    setRole("member");
    setError(null);
    setSent(null);
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

      const delivered = result?.emailDelivered !== false;
      if (delivered) {
        toast.success(`Invite sent to ${trimmedEmail}`);
      } else {
        toast.warning(
          `Invite created, but the email couldn’t be sent — copy the link to share it.`
        );
      }
      setSent({ email: trimmedEmail, link: result?.inviteLink ?? null, delivered });
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
        title={
          sent ? (sent.delivered ? "Invite sent" : "Invite created") : "Invite team member"
        }
        description={
          sent
            ? sent.delivered
              ? `We emailed an invite to ${sent.email}. If it doesn't arrive, copy the link below and send it directly.`
              : `The invite for ${sent.email} was created, but we couldn't send the email. Copy the link below and send it directly.`
            : `Send an invite to join this ${scope}. The invite expires in 7 days.`
        }
      >
        {sent ? (
          <>
            <ActionDialogBody className="space-y-4">
              <div className="flex items-start gap-2 text-sm text-foreground">
                {sent.delivered ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                )}
                <span>
                  {sent.delivered
                    ? `Invite email sent to ${sent.email}.`
                    : `Couldn’t send the email to ${sent.email}. Share the link below instead.`}
                </span>
              </div>
              {sent.link ? (
                <div className="space-y-2">
                  <Label>Shareable invite link</Label>
                  <InviteLinkField link={sent.link} />
                  <p className="text-caption">
                    Anyone with this link can accept the invite. It expires in 7 days.
                  </p>
                </div>
              ) : null}
            </ActionDialogBody>
            <ActionDialogFooter>
              <Button variant="ghost" onClick={() => setSent(null)} disabled={isInviting}>
                Invite another
              </Button>
              <Button onClick={() => handleOpenChange(false)}>Done</Button>
            </ActionDialogFooter>
          </>
        ) : (
          <>
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
          </>
        )}
      </ActionDialog>
    </>
  );
}
