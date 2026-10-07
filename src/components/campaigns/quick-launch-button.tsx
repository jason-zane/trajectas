"use client";

import { usePortal } from '@/components/portal-context'

import { useState } from "react";
import { Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuickLaunchModal } from "./quick-launch-modal";
import type { CampaignAssessmentOption } from "@/app/actions/campaigns";

interface QuickLaunchButtonProps {
  assessments: CampaignAssessmentOption[];
  clients: Array<{ id: string; name: string }>;
  forcedClientId?: string;
  successHrefPrefix?: string;
  creatorEmail?: string;
  /** Whether the 360 campaign type is offered (admin dashboard only). */
  allowLeadership360?: boolean;
}

function QuickLaunchButtonContent(props: QuickLaunchButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="default" onClick={() => setOpen(true)}>
        <Rocket className="size-4" />
        Quick Launch
      </Button>
      <QuickLaunchModal open={open} onOpenChange={setOpen} {...props} />
    </>
  );
}

export function QuickLaunchButton(props: QuickLaunchButtonProps) {
  const { features } = usePortal()
  return features.campaignManagement && features.assessmentDelivery ? <QuickLaunchButtonContent {...props} /> : null
}
