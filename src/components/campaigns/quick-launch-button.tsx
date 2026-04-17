"use client";

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
  label?: string;
  initialAssessmentId?: string;
}

export function QuickLaunchButton(props: QuickLaunchButtonProps) {
  const [open, setOpen] = useState(false);
  const { label = "Quick Launch", ...modalProps } = props;

  return (
    <>
      <Button variant="default" onClick={() => setOpen(true)}>
        <Rocket className="size-4" />
        {label}
      </Button>
      <QuickLaunchModal open={open} onOpenChange={setOpen} {...modalProps} />
    </>
  );
}
