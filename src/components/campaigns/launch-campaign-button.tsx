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

      <Dialog open={chooserOpen} onOpenChange={setChooserOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Launch campaign</DialogTitle>
            <DialogDescription>
              Start a new campaign from scratch or reuse an earlier setup.
              Reusing copies assessments, capabilities, and settings, but leaves
              participants and access links behind.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>New campaign</CardTitle>
                <CardDescription>
                  Use the guided flow to set up a campaign, attach an assessment,
                  and choose how you want to invite participants.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {initialAssessmentId ? (
                  <p className="text-sm text-muted-foreground">
                    The selected assessment will already be chosen when the
                    launch flow opens.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Best when you need a fresh campaign with a new assessment or
                    send method.
                  </p>
                )}
                <Button type="button" className="w-full" onClick={handleStartNew}>
                  <Rocket className="size-4" />
                  Start new campaign
                </Button>
              </CardContent>
            </Card>

            <Card className="h-full">
              <CardHeader>
                <CardTitle>Reuse previous campaign</CardTitle>
                <CardDescription>
                  Duplicate a recent campaign and review the assessment and
                  capabilities before you send it again.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {recentCampaigns.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No previous campaigns yet. Launch a new campaign first, then
                    you can reuse it next time.
                  </p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Select
                        value={selectedCampaign?.id ?? ""}
                        onValueChange={(value) =>
                          setSelectedCampaignId(value ?? "")
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a recent campaign" />
                        </SelectTrigger>
                        <SelectContent>
                          {recentCampaigns.map((campaign) => (
                            <SelectItem key={campaign.id} value={campaign.id}>
                              {campaign.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedCampaign ? (
                      <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-3 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{selectedCampaign.title}</p>
                            <p className="mt-1 text-muted-foreground">
                              {selectedCampaign.assessmentCount} assessment
                              {selectedCampaign.assessmentCount === 1 ? "" : "s"}{" "}
                              will be copied into a fresh draft.
                            </p>
                          </div>
                          <Badge
                            variant={
                              STATUS_VARIANTS[selectedCampaign.status] ?? "secondary"
                            }
                          >
                            {selectedCampaign.status.charAt(0).toUpperCase() +
                              selectedCampaign.status.slice(1)}
                          </Badge>
                        </div>
                      </div>
                    ) : null}

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={handleReuseCampaign}
                      disabled={!selectedCampaign || isReusing}
                    >
                      <RotateCcw className="size-4" />
                      {isReusing ? "Copying campaign..." : "Reuse this campaign"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
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
