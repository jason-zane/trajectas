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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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

      <Dialog open={chooserOpen} onOpenChange={(open) => { setChooserOpen(open); if (!open) setShowReuse(false); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Launch campaign</DialogTitle>
            <DialogDescription>
              Start fresh or duplicate a previous setup. Reusing copies
              assessments and settings but not participants.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleStartNew}
              className="group flex flex-col items-start gap-2 rounded-xl border border-border p-5 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
            >
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Rocket className="size-4" />
              </div>
              <p className="font-semibold">New campaign</p>
              <p className="text-xs text-muted-foreground">
                Guided setup with assessment and invite options.
              </p>
            </button>

            {recentCampaigns.length === 0 ? (
              <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-border p-5">
                <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <RotateCcw className="size-4" />
                </div>
                <p className="font-semibold text-muted-foreground">Reuse previous</p>
                <p className="text-xs text-muted-foreground">
                  No previous campaigns yet.
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowReuse(true)}
                className="group flex flex-col items-start gap-2 rounded-xl border border-border p-5 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
              >
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <RotateCcw className="size-4" />
                </div>
                <p className="font-semibold">Reuse previous</p>
                <p className="text-xs text-muted-foreground">
                  Duplicate setup, review before sending.
                </p>
              </button>
            )}
          </div>

          {showReuse && recentCampaigns.length > 0 && (
            <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
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

              {selectedCampaign && (
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
              )}

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
          )}
        </DialogContent>
      </Dialog>

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
