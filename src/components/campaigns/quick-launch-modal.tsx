"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Plus, Rocket, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ql-title">
                  Campaign title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ql-title"
                  placeholder="e.g. Q2 Leadership Assessment"
                  value={state.title}
                  onChange={(e) => setState((s) => ({ ...s, title: e.target.value }))}
                  autoFocus
                />
              </div>

              {!forcedClientId && (
                <div className="space-y-2">
                  <Label htmlFor="ql-client">
                    Client <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={state.clientId ?? ""}
                    onValueChange={(value) =>
                      setState((s) => ({ ...s, clientId: value || null }))
                    }
                  >
                    <SelectTrigger id="ql-client">
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          No clients available
                        </div>
                      ) : (
                        clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="ql-opens">Opens at</Label>
                  <Input
                    id="ql-opens"
                    type="date"
                    value={state.opensAt}
                    onChange={(e) => setState((s) => ({ ...s, opensAt: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ql-closes">Closes at</Label>
                  <Input
                    id="ql-closes"
                    type="date"
                    value={state.closesAt}
                    onChange={(e) => setState((s) => ({ ...s, closesAt: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ql-description">Description (optional)</Label>
                <Textarea
                  id="ql-description"
                  placeholder="A short internal note about this campaign"
                  value={state.description}
                  onChange={(e) =>
                    setState((s) => ({ ...s, description: e.target.value }))
                  }
                  rows={3}
                />
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-4">
              {assessments.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No assessments available to launch.
                  </p>
                  <a
                    href="/assessments/create"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                  >
                    <Plus className="size-4" />
                    Create an assessment (opens in a new tab)
                  </a>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Pick one assessment to launch with this campaign. You can add more later from the campaign edit page.
                  </p>
                  <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1">
                    {assessments.map((a) => {
                      const selected = state.selectedAssessmentId === a.id;
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() =>
                            setState((s) => ({ ...s, selectedAssessmentId: a.id }))
                          }
                          className={cn(
                            "w-full rounded-lg border p-4 text-left transition-colors",
                            selected
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-border/80 hover:bg-muted/40"
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium truncate">{a.title}</h4>
                                {a.status === "draft" && (
                                  <Badge variant="outline" className="text-xs">
                                    Draft
                                  </Badge>
                                )}
                              </div>
                              {a.description && (
                                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                                  {a.description}
                                </p>
                              )}
                              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                {a.factorCount > 0 && (
                                  <span>
                                    {a.factorCount} {a.factorCount === 1 ? "factor" : "factors"}
                                  </span>
                                )}
                                {a.sectionCount > 0 && (
                                  <span>
                                    {a.sectionCount} {a.sectionCount === 1 ? "section" : "sections"}
                                  </span>
                                )}
                                {a.formatLabel && <span>{a.formatLabel}</span>}
                                {a.totalItemCount > 0 && (
                                  <span>
                                    {a.totalItemCount} {a.totalItemCount === 1 ? "item" : "items"}
                                  </span>
                                )}
                                {a.estimatedDurationMinutes > 0 && (
                                  <span>~{a.estimatedDurationMinutes} min</span>
                                )}
                              </div>
                            </div>
                            <div
                              className={cn(
                                "mt-1 size-4 shrink-0 rounded-full border-2 transition-colors",
                                selected
                                  ? "border-primary bg-primary"
                                  : "border-muted-foreground/30"
                              )}
                            >
                              {selected && (
                                <div className="flex size-full items-center justify-center">
                                  <div className="size-1.5 rounded-full bg-primary-foreground" />
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
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
