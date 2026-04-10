"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Play, Pause, XCircle } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  activateCampaign,
  pauseCampaign,
  closeCampaign,
} from "@/app/actions/campaigns";
import type { CampaignStatus } from "@/types/database";

export function CampaignStatusActions({
  campaignId,
  campaignTitle,
  status,
  assessmentCount,
  pendingInviteCount,
  opensAt,
  closesAt,
}: {
  campaignId: string;
  campaignTitle: string;
  status: CampaignStatus;
  assessmentCount: number;
  pendingInviteCount: number;
  opensAt?: string;
  closesAt?: string;
}) {
  const [showActivateConfirm, setShowActivateConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  function formatDate(value?: string) {
    if (!value) return "Not scheduled";
    return new Intl.DateTimeFormat("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  }

  async function handleActivate() {
    startTransition(async () => {
      const result = await activateCampaign(campaignId);
      if (result?.error) {
        toast.error(result.error);
        return;
      }

      setShowActivateConfirm(false);
      toast.success("Campaign activated");
    });
  }

  async function handlePause() {
    const result = await pauseCampaign(campaignId);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Campaign paused");
  }

  async function handleClose() {
    const result = await closeCampaign(campaignId);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Campaign closed");
  }

  return (
    <>
      <div className="flex items-center gap-3">
        {(status === "draft" || status === "paused") && (
          <Button size="sm" onClick={() => setShowActivateConfirm(true)}>
            <Play className="size-4" />
            Activate
          </Button>
        )}
        {status === "active" && (
          <>
            <Button size="sm" variant="outline" onClick={handlePause}>
              <Pause className="size-4" />
              Pause
            </Button>
            <Button size="sm" variant="destructive" onClick={handleClose}>
              <XCircle className="size-4" />
              Close
            </Button>
          </>
        )}
        {status === "closed" && (
          <p className="text-sm text-muted-foreground">
            This campaign is closed. No new responses will be accepted.
          </p>
        )}
      </div>

      <ConfirmDialog
        open={showActivateConfirm}
        onOpenChange={setShowActivateConfirm}
        title="Activate campaign?"
        description="Review the campaign details before making it live."
        confirmLabel="Activate campaign"
        onConfirm={handleActivate}
        loading={isPending}
        details={
          <dl className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Campaign
              </dt>
              <dd className="font-medium text-foreground">{campaignTitle}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Assessments attached
              </dt>
              <dd className="font-medium text-foreground">{assessmentCount}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Pending invites
              </dt>
              <dd className="font-medium text-foreground">{pendingInviteCount}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Opens
              </dt>
              <dd className="font-medium text-foreground">{formatDate(opensAt)}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Closes
              </dt>
              <dd className="font-medium text-foreground">{formatDate(closesAt)}</dd>
            </div>
          </dl>
        }
      />
    </>
  );
}
