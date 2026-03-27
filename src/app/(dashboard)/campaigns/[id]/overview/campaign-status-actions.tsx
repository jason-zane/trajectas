"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, XCircle } from "lucide-react";
import {
  activateCampaign,
  pauseCampaign,
  closeCampaign,
} from "@/app/actions/campaigns";
import type { CampaignStatus } from "@/types/database";

export function CampaignStatusActions({
  campaignId,
  status,
}: {
  campaignId: string;
  status: CampaignStatus;
}) {
  async function handleActivate() {
    const result = await activateCampaign(campaignId);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Campaign activated");
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
    <div className="flex items-center gap-3">
      {(status === "draft" || status === "paused") && (
        <Button size="sm" onClick={handleActivate}>
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
  );
}
