"use client";

import { useState } from "react";
import { Copy, UserPlus } from "lucide-react";
import { toast } from "sonner";

import {
  ActionChoice,
  ActionDialog,
  ActionDialogBody,
} from "@/components/action-dialog";
import { Button } from "@/components/ui/button";
import { buildCampaignAccessLinkUrl } from "@/lib/campaign-access-links";

interface CampaignActionsDialogProps {
  campaignTitle: string;
  accessToken?: string | null;
  inviteHref: string;
  /** Shown when no access link exists; clicking takes the user to create one. */
  createLinkHref: string;
}

/**
 * Single-button "Actions" entry point for a campaign row. Collapses the
 * previous three-button cluster (copy-link / invite / results) into one
 * dialog with two action choices. Used on /client/campaigns table.
 */
export function CampaignActionsDialog({
  campaignTitle,
  accessToken,
  inviteHref,
  createLinkHref,
}: CampaignActionsDialogProps) {
  const [open, setOpen] = useState(false);

  async function handleCopyLink() {
    if (!accessToken || typeof window === "undefined" || !navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(
        buildCampaignAccessLinkUrl(accessToken, window.location.origin),
      );
      toast.success("Campaign link copied");
      setOpen(false);
    } catch {
      toast.error("Unable to copy campaign link");
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={`Actions for ${campaignTitle}`}
      >
        Actions
      </Button>

      <ActionDialog
        open={open}
        onOpenChange={setOpen}
        eyebrow="Manage campaign"
        title={campaignTitle}
        description="Send the access link or invite people directly."
      >
        <ActionDialogBody>
          <div className="grid gap-3 sm:grid-cols-2">
            <ActionChoice
              icon={Copy}
              title={accessToken ? "Copy access link" : "Create access link"}
              description={
                accessToken
                  ? "Paste this anywhere — Slack, email, SMS. Anyone with the link can start the assessment."
                  : "No link exists yet. Create one before you can share it."
              }
              recommended={Boolean(accessToken)}
              onClick={accessToken ? handleCopyLink : undefined}
              href={accessToken ? undefined : createLinkHref}
            />
            <ActionChoice
              icon={UserPlus}
              title="Invite participants"
              description="Send a branded invitation email straight to a single person or a list."
              href={inviteHref}
            />
          </div>
        </ActionDialogBody>
      </ActionDialog>
    </>
  );
}
