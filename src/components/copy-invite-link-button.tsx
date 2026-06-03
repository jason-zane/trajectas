"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Link2 } from "lucide-react";

import {
  ActionDialog,
  ActionDialogBody,
  ActionDialogFooter,
} from "@/components/action-dialog";
import { Button } from "@/components/ui/button";
import { InviteLinkField } from "@/components/invite-link-field";

interface CopyInviteLinkButtonProps {
  /**
   * Fetches a shareable link for this invite. For existing invites this
   * rotates the token (only the hash is stored), so the returned link replaces
   * any link previously sent.
   */
  getLink: () => Promise<{ inviteLink?: string; error?: string } | undefined>;
  /** Invitee email, shown in the dialog copy. */
  email?: string;
  label?: string;
  /** Render as a compact icon-only button (for table rows). */
  iconOnly?: boolean;
}

/**
 * Button that generates an invite link on demand and shows it in a dialog for
 * the admin to copy and share directly — the fallback when invite emails don't
 * reach the recipient (e.g. aggressive corporate spam filtering).
 */
export function CopyInviteLinkButton({
  getLink,
  email,
  label = "Copy link",
  iconOnly = false,
}: CopyInviteLinkButtonProps) {
  const [link, setLink] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await getLink();
      if (!result || result.error || !result.inviteLink) {
        toast.error(result?.error ?? "Couldn't generate an invite link.");
        return;
      }
      setLink(result.inviteLink);
    });
  }

  return (
    <>
      {iconOnly ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={handleClick}
          disabled={isPending}
          aria-label={label}
        >
          <Link2 />
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClick}
          disabled={isPending}
        >
          <Link2 className="size-4" />
          {isPending ? "Generating..." : label}
        </Button>
      )}

      <ActionDialog
        open={link !== null}
        onOpenChange={(open) => {
          if (!open) setLink(null);
        }}
        eyebrow="Invite"
        title="Share invite link"
        description={`Send this link to ${
          email ?? "the invitee"
        } directly. It replaces any link previously sent for this invite and expires in 7 days.`}
      >
        <ActionDialogBody className="space-y-3">
          {link ? <InviteLinkField link={link} /> : null}
        </ActionDialogBody>
        <ActionDialogFooter>
          <Button type="button" onClick={() => setLink(null)}>
            Done
          </Button>
        </ActionDialogFooter>
      </ActionDialog>
    </>
  );
}
