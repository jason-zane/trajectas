"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Rocket } from "lucide-react";
import { toast } from "sonner";

import {
  duplicateCampaignForReuse,
  type CampaignAssessmentOption,
} from "@/app/actions/campaigns";
import {
  ActionChoice,
  ActionDialog,
  ActionDialogBody,
} from "@/components/action-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

import { QuickLaunchModal } from "./quick-launch-modal";

type ReusableCampaign = {
  id: string;
  title: string;
  status: string;
  assessmentCount: number;
};

interface LaunchCampaignButtonProps {
  assessments: CampaignAssessmentOption[];
  clients: Array<{ id: string; name: string }>;
  recentCampaigns: ReusableCampaign[];
  forcedClientId?: string;
  successHrefPrefix?: string;
  label?: string;
  initialAssessmentId?: string;
}

const STATUS_VARIANTS: Record<
  string,
  "secondary" | "default" | "outline" | "destructive"
> = {
  draft: "secondary",
  active: "default",
  paused: "outline",
  closed: "destructive",
  archived: "outline",
};

export function LaunchCampaignButton({
  assessments,
  clients,
  recentCampaigns,
  forcedClientId,
  successHrefPrefix = "/campaigns",
  label = "Launch campaign",
  initialAssessmentId,
}: LaunchCampaignButtonProps) {
  const [chooserOpen, setChooserOpen] = useState(false);
  const [showReuse, setShowReuse] = useState(false);
  const [quickLaunchOpen, setQuickLaunchOpen] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState(
    recentCampaigns[0]?.id ?? "",
  );
  const [isReusing, setIsReusing] = useState(false);
  const router = useRouter();

  const successBaseHref = successHrefPrefix.endsWith("/")
    ? successHrefPrefix.slice(0, -1)
    : successHrefPrefix;
  const selectedCampaign =
    recentCampaigns.find((campaign) => campaign.id === selectedCampaignId) ??
    recentCampaigns[0] ??
    null;

  function handleStartNew() {
    setChooserOpen(false);
    setShowReuse(false);
    setQuickLaunchOpen(true);
  }

  function handleReuseCampaign() {
    const campaignToReuse = selectedCampaign;
    if (!campaignToReuse || isReusing) {
      return;
    }

    setIsReusing(true);
    void (async () => {
      try {
        const result = await duplicateCampaignForReuse(campaignToReuse.id);
        if ("error" in result && result.error) {
          toast.error("Unable to reuse campaign", {
            description: result.error,
          });
          return;
        }

        setChooserOpen(false);
        toast.success(`Copied "${campaignToReuse.title}"`, {
          description:
            "Review assessments and capabilities before inviting participants.",
        });
        router.push(`${successBaseHref}/${result.id}/assessments?reused=1`);
      } finally {
        setIsReusing(false);
      }
    })();
  }

  return (
    <>
      <Button variant="default" onClick={() => setChooserOpen(true)}>
        <Rocket className="size-4" />
        {label}
      </Button>

      <ActionDialog
        open={chooserOpen}
        onOpenChange={(open) => {
          setChooserOpen(open);
          if (!open) setShowReuse(false);
        }}
        eyebrow="Quick launch"
        title="Launch campaign"
        description="Start fresh or duplicate a previous setup. Reusing copies assessments and settings but not participants."
      >
        <ActionDialogBody>
          <div className="grid gap-3 sm:grid-cols-2">
            <ActionChoice
              icon={Rocket}
              title="New campaign"
              description="Guided setup with assessment and invite options."
              onClick={handleStartNew}
              recommended
            />
            {recentCampaigns.length === 0 ? (
              <ActionChoice
                icon={RotateCcw}
                title="Reuse previous"
                description="Duplicate setup, review before sending."
                disabled
                disabledHint="No previous campaigns yet."
              />
            ) : (
              <ActionChoice
                icon={RotateCcw}
                title="Reuse previous"
                description="Duplicate setup, review before sending."
                onClick={() => setShowReuse(true)}
              />
            )}
          </div>

          {showReuse && recentCampaigns.length > 0 ? (
            <div className="mt-5 space-y-3 rounded-xl border border-border bg-muted/30 p-4">
              <Select
                value={selectedCampaign?.id ?? ""}
                onValueChange={(value) => setSelectedCampaignId(value ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a campaign to reuse">
                    {selectedCampaign?.title ?? "Choose a campaign to reuse"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {recentCampaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedCampaign ? (
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">
                    {selectedCampaign.assessmentCount} assessment
                    {selectedCampaign.assessmentCount === 1 ? "" : "s"} will be
                    copied
                  </span>
                  <Badge
                    variant={STATUS_VARIANTS[selectedCampaign.status] ?? "secondary"}
                  >
                    {selectedCampaign.status.charAt(0).toUpperCase() +
                      selectedCampaign.status.slice(1)}
                  </Badge>
                </div>
              ) : null}

              <Button
                type="button"
                className="w-full"
                onClick={handleReuseCampaign}
                disabled={!selectedCampaign || isReusing}
              >
                <RotateCcw className="size-4" />
                {isReusing ? "Copying campaign..." : "Reuse this campaign"}
              </Button>
            </div>
          ) : null}
        </ActionDialogBody>
      </ActionDialog>

      <QuickLaunchModal
        open={quickLaunchOpen}
        onOpenChange={setQuickLaunchOpen}
        assessments={assessments}
        clients={clients}
        forcedClientId={forcedClientId}
        successHrefPrefix={successHrefPrefix}
        initialAssessmentId={initialAssessmentId}
      />
    </>
  );
}
