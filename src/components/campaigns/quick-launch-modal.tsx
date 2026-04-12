"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import {
  activateCampaign,
  addAssessmentToCampaign,
  bulkInviteParticipants,
  createAccessLink,
  createCampaign,
  deleteCampaign,
  inviteParticipant,
  type CampaignAssessmentOption,
} from "@/app/actions/campaigns";
import { ArrowLeft, ArrowRight, FileText, Link2, Mail, Plus, Rocket, X } from "lucide-react";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);

  const suffix = Math.random().toString(36).slice(2, 8);
  return base ? `${base}-${suffix}` : `campaign-${suffix}`;
}

function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

function isInviteCsvHeader(parts: string[]): boolean {
  const [first = "", second = "", third = ""] = parts.map((part) =>
    part.toLowerCase().replace(/\s+/g, "_"),
  );

  return (
    first === "email" &&
    (!second || second === "first_name" || second === "firstname") &&
    (!third || third === "last_name" || third === "lastname")
  );
}

function parseCsvInvites(
  csv: string,
): Array<{ email: string; firstName?: string; lastName?: string }> {
  return csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .reduce<Array<{ email: string; firstName?: string; lastName?: string }>>(
      (rows, line, index) => {
        const parts = line.split(",").map((part) => part.trim());
        if (index === 0 && isInviteCsvHeader(parts)) {
          return rows;
        }

        rows.push({
          email: parts[0] ?? "",
          firstName: parts[1] || undefined,
          lastName: parts[2] || undefined,
        });

        return rows;
      },
      [],
    );
}

function toIsoDateTime(value: string): string | undefined {
  return value ? new Date(value).toISOString() : undefined;
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function getErrorMessage(error: unknown): string {
  if (typeof error === "string" && error.length > 0) {
    return error;
  }

  if (error && typeof error === "object") {
    const values = Object.values(error as Record<string, unknown>).flatMap((value) => {
      if (typeof value === "string") {
        return [value];
      }

      if (Array.isArray(value)) {
        return value.filter((item): item is string => typeof item === "string");
      }

      return [];
    });

    if (values.length > 0) {
      return values[0];
    }
  }

  return "Something went wrong.";
}

interface QuickLaunchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assessments: CampaignAssessmentOption[];
  clients: Array<{ id: string; name: string }>;
  forcedClientId?: string;
  successHrefPrefix?: string;
}

type WizardStep = 1 | 2 | 3;

interface WizardState {
  title: string;
  clientId: string | null;
  opensAt: string;
  closesAt: string;
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
  const [slideDirection, setSlideDirection] = useState<"left" | "right">("left");
  const router = useRouter();

  const campaignTitle = state.title.trim();
  const effectiveClientId = state.clientId ?? forcedClientId ?? null;
  const selectedClient = clients.find((client) => client.id === effectiveClientId);
  const selectedAssessment = assessments.find(
    (assessment) => assessment.id === state.selectedAssessmentId,
  );
  const csvInviteRows = parseCsvInvites(state.inviteCsv);
  const csvValidInviteCount = csvInviteRows.filter((row) => isValidEmail(row.email)).length;
  const csvInvalidInviteCount = csvInviteRows.length - csvValidInviteCount;
  const scheduleError =
    state.opensAt && state.closesAt && state.closesAt < state.opensAt
      ? "Close time must be after the open time."
      : null;
  const singleEmailError =
    state.inviteSingleEmail.trim().length > 0 && !isValidEmail(state.inviteSingleEmail)
      ? "Enter a valid email address."
      : null;
  const successBaseHref = successHrefPrefix.endsWith("/")
    ? successHrefPrefix.slice(0, -1)
    : successHrefPrefix;

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
    if (!next) {
      reset();
    }
    onOpenChange(next);
  }

  function canAdvance(): boolean {
    if (step === 1) {
      return campaignTitle.length > 0 && !scheduleError;
    }
    if (step === 2) {
      return !!state.selectedAssessmentId;
    }
    if (state.inviteMode === "link") {
      return true;
    }
    if (state.inviteMode === "single") {
      return state.inviteSingleEmail.trim().length > 0 && !singleEmailError;
    }
    return csvValidInviteCount > 0;
  }

  function handleNext() {
    if (step < 3 && canAdvance()) {
      setSlideDirection("left");
      setStep((currentStep) => (currentStep + 1) as WizardStep);
    }
  }

  function handleBack() {
    if (step > 1) {
      setSlideDirection("right");
      setStep((currentStep) => (currentStep - 1) as WizardStep);
    }
  }

  async function handleLaunch() {
    if (!canAdvance() || !state.selectedAssessmentId) {
      return;
    }

    setIsLaunching(true);
    let createdCampaignId: string | null = null;

    try {
      const createResult = await createCampaign({
        title: campaignTitle,
        slug: generateSlug(campaignTitle),
        description: state.description.trim() || undefined,
        clientId: effectiveClientId || undefined,
        opensAt: toIsoDateTime(state.opensAt),
        closesAt: toIsoDateTime(state.closesAt),
        status: "draft",
        allowResume: true,
        showProgress: true,
        randomizeAssessmentOrder: false,
      });

      if ("error" in createResult && createResult.error) {
        throw new Error(getErrorMessage(createResult.error));
      }

      const campaignId = createResult.id;
      createdCampaignId = campaignId;

      const addAssessmentResult = await addAssessmentToCampaign(
        campaignId,
        state.selectedAssessmentId,
      );
      if (addAssessmentResult?.error) {
        throw new Error(addAssessmentResult.error);
      }

      let successDetail = "";
      let successDescription: string | undefined;

      if (state.inviteMode === "single") {
        const inviteResult = await inviteParticipant(campaignId, {
          email: state.inviteSingleEmail.trim(),
          firstName: state.inviteSingleFirstName.trim() || undefined,
          lastName: state.inviteSingleLastName.trim() || undefined,
        });

        if ("error" in inviteResult && inviteResult.error) {
          throw new Error(getErrorMessage(inviteResult.error));
        }

        if (inviteResult.emailSent) {
          successDetail = "1 invite sent";
        } else {
          successDetail = "participant added";
          successDescription =
            inviteResult.emailError ??
            "Invite email failed. You can resend it from the participants page.";
        }
      }

      if (state.inviteMode === "csv") {
        const bulkResult = await bulkInviteParticipants(campaignId, csvInviteRows);

        if ("error" in bulkResult && bulkResult.error) {
          throw new Error(getErrorMessage(bulkResult.error));
        }

        if (!("success" in bulkResult) || !bulkResult.success || bulkResult.inserted === 0) {
          const bulkErrors = "errors" in bulkResult ? bulkResult.errors ?? [] : [];
          const firstRowError =
            bulkErrors[0]?.message ?? "No participants were added.";
          throw new Error(firstRowError);
        }

        const bulkErrors = "errors" in bulkResult ? bulkResult.errors ?? [] : [];
        successDetail = `${pluralize(bulkResult.inserted, "invite")} sent`;

        const notes = [];
        if (bulkResult.existingCount > 0) {
          notes.push(`${pluralize(bulkResult.existingCount, "invite")} already existed`);
        }
        if (bulkErrors.length > 0) {
          notes.push(`${pluralize(bulkErrors.length, "row")} skipped`);
        }
        if (notes.length > 0) {
          successDescription = notes.join(" · ");
        }
      }

      if (state.inviteMode === "link") {
        const linkResult = await createAccessLink(campaignId, {
          label: campaignTitle,
        });

        if ("error" in linkResult && linkResult.error) {
          throw new Error(getErrorMessage(linkResult.error));
        }

        let copied = false;
        try {
          await navigator.clipboard.writeText(
            `${window.location.origin}/assess/join/${linkResult.token}`,
          );
          copied = true;
        } catch {
          copied = false;
        }

        successDetail = copied ? "access link copied" : "access link created";
        if (!copied) {
          successDescription = "The access link is available on the campaign overview.";
        }
      }

      const activateResult = await activateCampaign(campaignId);
      if (activateResult?.error) {
        throw new Error(activateResult.error);
      }

      handleOpenChange(false);
      toast.success(`Campaign "${campaignTitle}" launched — ${successDetail}`, {
        description: successDescription,
      });
      router.push(`${successBaseHref}/${campaignId}/overview`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to complete quick launch.";

      if (createdCampaignId) {
        const rollbackResult = await deleteCampaign(createdCampaignId);
        const rollbackNote = rollbackResult?.error
          ? ` Rollback also failed: ${rollbackResult.error}. Delete the draft campaign manually.`
          : "";

        toast.error("Quick launch failed", {
          description: `${message}${rollbackNote}`,
          duration: 10000,
        });
      } else {
        toast.error("Quick launch failed", {
          description: message,
          duration: 10000,
        });
      }
    } finally {
      setIsLaunching(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* Keyframe animations for step transitions */}
      <style>{`
        @keyframes ql-slide-left {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes ql-slide-right {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
      <DialogContent className="max-w-2xl">
        {/* Progress header */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <DialogHeader className="p-0">
              <DialogTitle className="text-lg">Quick Launch</DialogTitle>
            </DialogHeader>
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              {step} / 3
            </span>
          </div>

          {/* Progress bar */}
          <div className="relative h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${(step / 3) * 100}%`,
                background: "var(--brand-primary, hsl(var(--primary)))",
              }}
            />
          </div>

          {/* Step labels */}
          <div className="flex items-center gap-4">
            {([
              { id: 1 as const, label: "Campaign" },
              { id: 2 as const, label: "Assessment" },
              { id: 3 as const, label: "Invite" },
            ]).map((item) => {
              const isActive = step === item.id;
              const isComplete = step > item.id;
              return (
                <div key={item.id} className="flex items-center gap-1.5">
                  <div
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full text-[10px] font-bold transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : isComplete
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {isComplete ? "\u2713" : item.id}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium transition-colors",
                      isActive
                        ? "text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step content — animated slide on step change */}
        <div
          key={step}
          className="py-4"
          style={{
            animation: `${slideDirection === "left" ? "ql-slide-left" : "ql-slide-right"} 200ms ease-out`,
          }}
        >
          {step === 1 && (
            <div className="space-y-4">
              {forcedClientId && selectedClient && (
                <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
                  Launching inside <span className="font-medium">{selectedClient.name}</span>.
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="ql-title">
                  Campaign title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ql-title"
                  placeholder="e.g. Q2 Leadership Assessment"
                  value={state.title}
                  onChange={(event) =>
                    setState((currentState) => ({
                      ...currentState,
                      title: event.target.value,
                    }))
                  }
                  autoFocus
                />
              </div>

              {!forcedClientId && (
                <div className="space-y-2">
                  <Label htmlFor="ql-client">
                    Client <span className="text-muted-foreground text-xs font-normal">(optional)</span>
                  </Label>
                  <Select
                    value={state.clientId ?? ""}
                    onValueChange={(value) =>
                      setState((currentState) => ({
                        ...currentState,
                        clientId: value || null,
                      }))
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
                    type="datetime-local"
                    value={state.opensAt}
                    onChange={(event) =>
                      setState((currentState) => ({
                        ...currentState,
                        opensAt: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ql-closes">Closes at</Label>
                  <Input
                    id="ql-closes"
                    type="datetime-local"
                    value={state.closesAt}
                    onChange={(event) =>
                      setState((currentState) => ({
                        ...currentState,
                        closesAt: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              {scheduleError && (
                <p className="text-sm text-destructive">{scheduleError}</p>
              )}

              <div className="space-y-2">
                <Label htmlFor="ql-description">Description (optional)</Label>
                <Textarea
                  id="ql-description"
                  placeholder="A short internal note about this campaign"
                  value={state.description}
                  onChange={(event) =>
                    setState((currentState) => ({
                      ...currentState,
                      description: event.target.value,
                    }))
                  }
                  rows={3}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
                <div className="font-medium">{campaignTitle || "Untitled campaign"}</div>
                {selectedClient && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Client: {selectedClient.name}
                  </div>
                )}
              </div>

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
                  <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                    {assessments.map((assessment) => {
                      const selected = state.selectedAssessmentId === assessment.id;

                      return (
                        <button
                          key={assessment.id}
                          type="button"
                          onClick={() =>
                            setState((currentState) => ({
                              ...currentState,
                              selectedAssessmentId: assessment.id,
                            }))
                          }
                          className={cn(
                            "w-full rounded-lg border p-4 text-left transition-colors",
                            selected
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-border/80 hover:bg-muted/40",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="truncate font-medium">{assessment.title}</h4>
                                {assessment.status === "draft" && (
                                  <Badge variant="outline" className="text-xs">
                                    Draft
                                  </Badge>
                                )}
                              </div>
                              {assessment.description && (
                                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                  {assessment.description}
                                </p>
                              )}
                              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                {assessment.factorCount > 0 && (
                                  <span>
                                    {assessment.factorCount}{" "}
                                    {assessment.factorCount === 1 ? "factor" : "factors"}
                                  </span>
                                )}
                                {assessment.sectionCount > 0 && (
                                  <span>
                                    {assessment.sectionCount}{" "}
                                    {assessment.sectionCount === 1 ? "section" : "sections"}
                                  </span>
                                )}
                                {assessment.formatLabel && <span>{assessment.formatLabel}</span>}
                                {assessment.totalItemCount > 0 && (
                                  <span>
                                    {assessment.totalItemCount}{" "}
                                    {assessment.totalItemCount === 1 ? "item" : "items"}
                                  </span>
                                )}
                                {assessment.estimatedDurationMinutes > 0 && (
                                  <span>~{assessment.estimatedDurationMinutes} min</span>
                                )}
                              </div>
                            </div>
                            <div
                              className={cn(
                                "mt-1 size-4 shrink-0 rounded-full border-2 transition-colors",
                                selected
                                  ? "border-primary bg-primary"
                                  : "border-muted-foreground/30",
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
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
                <div className="font-medium">{campaignTitle || "Untitled campaign"}</div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {selectedClient && <span>{selectedClient.name}</span>}
                  {selectedAssessment && <span>{selectedAssessment.title}</span>}
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                Choose how you want to invite participants. You can always add more later from the campaign participants page.
              </p>

              <div className="grid grid-cols-3 gap-2">
                {([
                  {
                    value: "single" as const,
                    label: "Single email",
                    description: "Invite one person",
                    icon: Mail,
                  },
                  {
                    value: "csv" as const,
                    label: "Paste CSV",
                    description: "Bulk invite",
                    icon: FileText,
                  },
                  {
                    value: "link" as const,
                    label: "Access link",
                    description: "Share a URL",
                    icon: Link2,
                  },
                ]).map((mode) => {
                  const Icon = mode.icon;
                  const selected = state.inviteMode === mode.value;

                  return (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() =>
                        setState((currentState) => ({
                          ...currentState,
                          inviteMode: mode.value,
                        }))
                      }
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-colors",
                        selected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-border/80 hover:bg-muted/40",
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-5",
                          selected ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                      <div className="text-xs font-medium">{mode.label}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {mode.description}
                      </div>
                    </button>
                  );
                })}
              </div>

              {state.inviteMode === "single" && (
                <div className="space-y-3 rounded-lg border border-border p-4">
                  <div className="space-y-2">
                    <Label htmlFor="ql-invite-email">
                      Email <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="ql-invite-email"
                      type="email"
                      placeholder="participant@company.com"
                      value={state.inviteSingleEmail}
                      onChange={(event) =>
                        setState((currentState) => ({
                          ...currentState,
                          inviteSingleEmail: event.target.value,
                        }))
                      }
                    />
                    {singleEmailError && (
                      <p className="text-xs text-destructive">{singleEmailError}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="ql-invite-first">First name</Label>
                      <Input
                        id="ql-invite-first"
                        placeholder="Jane"
                        value={state.inviteSingleFirstName}
                        onChange={(event) =>
                          setState((currentState) => ({
                            ...currentState,
                            inviteSingleFirstName: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ql-invite-last">Last name</Label>
                      <Input
                        id="ql-invite-last"
                        placeholder="Doe"
                        value={state.inviteSingleLastName}
                        onChange={(event) =>
                          setState((currentState) => ({
                            ...currentState,
                            inviteSingleLastName: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              )}

              {state.inviteMode === "csv" && (
                <div className="space-y-2 rounded-lg border border-border p-4">
                  <Label htmlFor="ql-invite-csv">
                    Paste CSV <span className="text-destructive">*</span>
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    One row per participant. Format:{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                      email,first_name,last_name
                    </code>
                    . First name and last name are optional.
                  </p>
                  <Textarea
                    id="ql-invite-csv"
                    placeholder={`email,first_name,last_name\njane@example.com,Jane,Doe\njohn@example.com,John,Smith`}
                    value={state.inviteCsv}
                    onChange={(event) =>
                      setState((currentState) => ({
                        ...currentState,
                        inviteCsv: event.target.value,
                      }))
                    }
                    rows={6}
                    className="font-mono text-xs"
                  />
                  <p
                    className={cn(
                      "text-xs",
                      csvInvalidInviteCount > 0
                        ? "text-amber-700 dark:text-amber-300"
                        : "text-muted-foreground",
                    )}
                  >
                    {csvInviteRows.length === 0
                      ? "Paste one or more rows to bulk invite participants."
                      : `Ready to send ${pluralize(csvValidInviteCount, "invite")}${
                          csvInvalidInviteCount > 0
                            ? ` · ${pluralize(csvInvalidInviteCount, "row")} need attention`
                            : ""
                        }.`}
                  </p>
                </div>
              )}

              {state.inviteMode === "link" && (
                <div className="rounded-lg border border-border p-4">
                  <p className="text-sm text-muted-foreground">
                    A shareable access link will be generated when you click Launch. Anyone with the link can take the assessment — no per-participant invite emails will be sent. You can still add individual participants later.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

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
