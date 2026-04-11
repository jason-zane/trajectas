"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Rocket, X } from "lucide-react";
import type { CampaignAssessmentOption } from "@/app/actions/campaigns";

interface QuickLaunchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assessments: CampaignAssessmentOption[];
  clients: Array<{ id: string; name: string }>;
  /** When a client id is forced (e.g., client portal), hide the client dropdown and pre-select. */
  forcedClientId?: string;
  /** Redirect target after successful launch — defaults to /campaigns/{id}/overview but portals can override */
  successHrefPrefix?: string;
}

type WizardStep = 1 | 2 | 3;

interface WizardState {
  title: string;
  clientId: string | null;
  opensAt: string; // ISO string
  closesAt: string; // ISO string
  description: string;
  selectedAssessmentId: string | null;
  inviteMode: "single" | "csv" | "link";
  inviteSingleEmail: string;
  inviteSingleFirstName: string;
  inviteSingleLastName: string;
  inviteCsv: string;
}

export function QuickLaunchModal({
  open,
  onOpenChange,
  assessments,
  clients,
  forcedClientId,
  successHrefPrefix = "/campaigns",
}: QuickLaunchModalProps) {
  const [step, setStep] = useState<WizardStep>(1);
  const [state, setState] = useState<WizardState>({
    title: "",
    clientId: forcedClientId ?? null,
    opensAt: "",
    closesAt: "",
    description: "",
    selectedAssessmentId: null,
    inviteMode: "single",
    inviteSingleEmail: "",
    inviteSingleFirstName: "",
    inviteSingleLastName: "",
    inviteCsv: "",
  });
  const [isLaunching, setIsLaunching] = useState(false);

  function reset() {
    setStep(1);
    setState({
      title: "",
      clientId: forcedClientId ?? null,
      opensAt: "",
      closesAt: "",
      description: "",
      selectedAssessmentId: null,
      inviteMode: "single",
      inviteSingleEmail: "",
      inviteSingleFirstName: "",
      inviteSingleLastName: "",
      inviteCsv: "",
    });
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  // Step validation — determines whether Next/Launch is enabled.
  // Placeholder implementations; later tasks will tighten these.
  function canAdvance(): boolean {
    if (step === 1) return state.title.trim().length > 0 && !!state.clientId;
    if (step === 2) return !!state.selectedAssessmentId;
    if (step === 3) {
      if (state.inviteMode === "link") return true;
      if (state.inviteMode === "single") return state.inviteSingleEmail.trim().length > 0;
      if (state.inviteMode === "csv") return state.inviteCsv.trim().length > 0;
    }
    return false;
  }

  function handleNext() {
    if (step < 3) setStep((s) => (s + 1) as WizardStep);
  }

  function handleBack() {
    if (step > 1) setStep((s) => (s - 1) as WizardStep);
  }

  async function handleLaunch() {
    // Stub — fully implemented in P5.1e.
    setIsLaunching(true);
    try {
      console.log("[quick-launch] Would launch with state:", state);
      // Simulate success for now
      alert("Launch handler not yet implemented. See P5.1e.");
      handleOpenChange(false);
    } finally {
      setIsLaunching(false);
    }
  }

  // Suppress unused variable warning — successHrefPrefix is used in P5.1e
  void successHrefPrefix;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Quick Launch Campaign</DialogTitle>
          <DialogDescription>
            Step {step} of 3 —{" "}
            {step === 1
              ? "Campaign details"
              : step === 2
              ? "Select assessment"
              : "Invite participants"}
          </DialogDescription>
        </DialogHeader>

        {/* Step content — filled in by P5.1b / P5.1c / P5.1d */}
        <div className="py-4">
          {step === 1 && (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Step 1 placeholder — campaign details form (P5.1b)
              <br />
              <span className="text-xs">
                {clients.length} client(s) available
                {forcedClientId && " — forced to one"}
              </span>
            </div>
          )}
          {step === 2 && (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Step 2 placeholder — assessment picker (P5.1c)
              <br />
              <span className="text-xs">{assessments.length} assessment(s) available</span>
            </div>
          )}
          {step === 3 && (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Step 3 placeholder — invite mode (P5.1d)
            </div>
          )}
        </div>

        {/* Footer navigation */}
        <div className="flex items-center justify-between border-t border-border pt-4">
          <Button
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={isLaunching}
          >
            <X className="size-4" />
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            {step > 1 && (
              <Button variant="outline" onClick={handleBack} disabled={isLaunching}>
                <ArrowLeft className="size-4" />
                Back
              </Button>
            )}
            {step < 3 ? (
              <Button onClick={handleNext} disabled={!canAdvance() || isLaunching}>
                Next
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button onClick={handleLaunch} disabled={!canAdvance() || isLaunching}>
                <Rocket className="size-4" />
                {isLaunching ? "Launching..." : "Launch"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
