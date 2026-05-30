"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ActionDialog,
  ActionWizard,
  type ActionWizardStep,
} from "@/components/action-dialog";
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
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  activateCampaign,
  addAssessmentToCampaign,
  updateCampaignConsultantSettings,
  bulkInviteParticipants,
  createAccessLink,
  createCampaign,
  deleteCampaign,
  inviteParticipant,
  type CampaignAssessmentOption,
} from "@/app/actions/campaigns";
import { getFactorsForAssessment } from "@/app/actions/factor-selection";
import { saveFactorSelection } from "@/app/actions/factor-selection";
import { getItemSelectionRulesForEstimate } from "@/app/actions/item-selection-rules";
import { addRater, markApprovedRatersInvited } from "@/app/actions/raters";
import {
  FileText,
  Link2,
  Mail,
  Plus,
  Rocket,
  User,
  Users,
  Trash2,
} from "lucide-react";
import type { RaterRelationship } from "@/types/database";
import {
  CapabilitySelectionStep,
} from "./capability-selection-step";
import { NotificationsStep, type NotificationsStepValue } from "./notifications-step";
import { type FactorAssessmentData } from "./capability-selection-step";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A rater being collected in the wizard (not yet persisted). */
interface RaterDraft {
  relationship: RaterRelationship;
  name: string;
  email: string;
}

const OBSERVER_RELATIONSHIPS: { value: RaterRelationship; label: string }[] = [
  { value: "manager", label: "Manager" },
  { value: "peer", label: "Peer" },
  { value: "direct_report", label: "Direct report" },
  { value: "other", label: "Other" },
];

const RELATIONSHIP_LABELS: Record<string, string> = {
  manager: "Manager",
  peer: "Peer",
  direct_report: "Direct report",
  other: "Other",
};

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
  initialAssessmentId?: string;
  /** Email of the user opening the wizard — prefilled into the notifications step recipient list. */
  creatorEmail?: string;
  /** Whether the 360 campaign type is offered (admin test-bed only). */
  allowLeadership360?: boolean;
}

type StepId =
  | "type"
  | "campaign"
  | "assessment"
  | "capabilities"
  | "notifications"
  | "invite"
  | "subject"
  | "raters";

type CampaignKind = "self" | "leadership_360";

type ItemSelectionRule = {
  minConstructs: number;
  maxConstructs: number | null;
  itemsPerConstruct: number;
};

interface WizardState {
  campaignKind: CampaignKind;
  title: string;
  clientId: string | null;
  opensAt: string;
  closesAt: string;
  description: string;
  selectedAssessmentId: string | null;
  selectedCapabilityIds: string[] | null;
  assessmentFactors: FactorAssessmentData;
  itemSelectionRules: ItemSelectionRule[];
  inviteMode: "single" | "csv" | "link";
  inviteSingleEmail: string;
  inviteSingleFirstName: string;
  inviteSingleLastName: string;
  inviteCsv: string;
  notifications: NotificationsStepValue;
  // 360-only
  subjectFirstName: string;
  subjectLastName: string;
  subjectEmail: string;
  raters: RaterDraft[];
  raterRelationship: RaterRelationship;
  raterName: string;
  raterEmail: string;
  sendInvitesNow: boolean;
}

export function QuickLaunchModal({
  open,
  onOpenChange,
  assessments,
  clients,
  forcedClientId,
  successHrefPrefix = "/campaigns",
  initialAssessmentId,
  creatorEmail,
  allowLeadership360 = false,
}: QuickLaunchModalProps) {
  const [stepId, setStepId] = useState<StepId>(
    allowLeadership360 ? "type" : "campaign",
  );
  const [state, setState] = useState<WizardState>({
    campaignKind: "self",
    title: "",
    clientId: forcedClientId ?? null,
    opensAt: "",
    closesAt: "",
    description: "",
    selectedAssessmentId: initialAssessmentId ?? null,
    selectedCapabilityIds: null,
    assessmentFactors: [],
    itemSelectionRules: [],
    inviteMode: "link",
    inviteSingleEmail: "",
    inviteSingleFirstName: "",
    inviteSingleLastName: "",
    inviteCsv: "",
    notifications: {
      enabled: true,
      emails: creatorEmail ? [creatorEmail] : [],
      includeSummary: true,
      attachPdf: true,
    },
    subjectFirstName: "",
    subjectLastName: "",
    subjectEmail: "",
    raters: [],
    raterRelationship: "peer",
    raterName: "",
    raterEmail: "",
    sendInvitesNow: true,
  });
  const [isLaunching, setIsLaunching] = useState(false);
  const [loadingCapabilities, setLoadingCapabilities] = useState(false);
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

  const hasCapabilities = state.assessmentFactors.length > 0;
  const supportsCustomisation = selectedAssessment?.minCustomFactors != null;

  // Hide the Capabilities step entirely for assessments that don't expose
  // customisation. Before an assessment has been picked we keep it visible so
  // the indicator doesn't grow once the user makes a selection.
  const includeCapabilitiesStep = !selectedAssessment || supportsCustomisation;

  const is360 = state.campaignKind === "leadership_360";
  const subjectEmailError =
    state.subjectEmail.trim().length > 0 && !isValidEmail(state.subjectEmail)
      ? "Enter a valid email address."
      : null;
  const raterEmailError =
    state.raterEmail.trim().length > 0 && !isValidEmail(state.raterEmail)
      ? "Enter a valid email address."
      : null;

  const wizardSteps: ActionWizardStep[] = [
    ...(allowLeadership360 ? [{ id: "type", label: "Type" }] : []),
    { id: "campaign", label: "Campaign" },
    { id: "assessment", label: "Assessment" },
    ...(includeCapabilitiesStep
      ? [{ id: "capabilities", label: "Capabilities" }]
      : []),
    { id: "notifications", label: "Notifications" },
    // A 360 collects a subject + raters; a self campaign invites participants.
    ...(is360
      ? [
          { id: "subject", label: "Subject" },
          { id: "raters", label: "Raters" },
        ]
      : [{ id: "invite", label: "Invite" }]),
  ];

  const currentStepIndex = Math.max(
    0,
    wizardSteps.findIndex((s) => s.id === stepId),
  );

  function reset() {
    setStepId(allowLeadership360 ? "type" : "campaign");
    setState({
      campaignKind: "self",
      title: "",
      clientId: forcedClientId ?? null,
      opensAt: "",
      closesAt: "",
      description: "",
      selectedAssessmentId: initialAssessmentId ?? null,
      selectedCapabilityIds: null,
      assessmentFactors: [],
      itemSelectionRules: [],
      inviteMode: "link",
      inviteSingleEmail: "",
      inviteSingleFirstName: "",
      inviteSingleLastName: "",
      inviteCsv: "",
      notifications: {
        enabled: true,
        emails: creatorEmail ? [creatorEmail] : [],
        includeSummary: true,
        attachPdf: true,
      },
      subjectFirstName: "",
      subjectLastName: "",
      subjectEmail: "",
      raters: [],
      raterRelationship: "peer",
      raterName: "",
      raterEmail: "",
      sendInvitesNow: true,
    });
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      reset();
    }
    onOpenChange(next);
  }

  function canAdvance(): boolean {
    if (stepId === "type") {
      return true; // a kind is always selected (defaults to self)
    }
    if (stepId === "campaign") {
      return campaignTitle.length > 0 && !scheduleError;
    }
    if (stepId === "assessment") {
      return !!state.selectedAssessmentId;
    }
    if (stepId === "capabilities") {
      return (
        state.selectedCapabilityIds === null ||
        state.selectedCapabilityIds.length > 0
      );
    }
    if (stepId === "notifications") {
      // No required fields — disabled is a valid choice.
      return true;
    }
    if (stepId === "subject") {
      return state.subjectEmail.trim().length > 0 && !subjectEmailError;
    }
    if (stepId === "raters") {
      // Raters are optional in the wizard — more can be added on the tab.
      return true;
    }
    // Invite step (self campaigns)
    if (state.inviteMode === "link") {
      return true;
    }
    if (state.inviteMode === "single") {
      return state.inviteSingleEmail.trim().length > 0 && !singleEmailError;
    }
    return csvValidInviteCount > 0;
  }

  async function fetchCapabilitiesForAssessment(assessmentId: string) {
    setLoadingCapabilities(true);
    try {
      const [capabilities, rules] = await Promise.all([
        getFactorsForAssessment(assessmentId),
        getItemSelectionRulesForEstimate(),
      ]);
      setState((s) => ({
        ...s,
        assessmentFactors: capabilities as FactorAssessmentData,
        itemSelectionRules: rules,
        selectedCapabilityIds: null,
      }));
    } finally {
      setLoadingCapabilities(false);
    }
  }

  function selectAssessment(assessmentId: string) {
    setState((currentState) => ({
      ...currentState,
      selectedAssessmentId: assessmentId,
      selectedCapabilityIds: null,
      assessmentFactors: [],
      itemSelectionRules: [],
    }));
    void fetchCapabilitiesForAssessment(assessmentId);
  }

  function addRaterDraft() {
    const email = state.raterEmail.trim().toLowerCase();
    if (!isValidEmail(email)) return;
    if (email === state.subjectEmail.trim().toLowerCase()) {
      toast.error("The subject can't be one of their own raters.");
      return;
    }
    if (state.raters.some((r) => r.email.toLowerCase() === email)) {
      toast.error("That rater has already been added.");
      return;
    }
    setState((s) => ({
      ...s,
      raters: [
        ...s.raters,
        { relationship: s.raterRelationship, name: s.raterName.trim(), email },
      ],
      raterName: "",
      raterEmail: "",
    }));
  }

  function removeRaterDraft(index: number) {
    setState((s) => ({
      ...s,
      raters: s.raters.filter((_, i) => i !== index),
    }));
  }

  async function handleNext() {
    if (!canAdvance()) return;

    // Block the transition out of the Assessment step until capabilities have
    // loaded, so the next step renders the Capabilities panel directly (or
    // skips to Notifications) instead of flashing while the fetch resolves.
    if (
      stepId === "assessment" &&
      state.selectedAssessmentId &&
      state.assessmentFactors.length === 0
    ) {
      await fetchCapabilitiesForAssessment(state.selectedAssessmentId);
    }

    const idx = wizardSteps.findIndex((s) => s.id === stepId);
    const next = wizardSteps[idx + 1];
    if (next) {
      setSlideDirection("left");
      setStepId(next.id as StepId);
    }
  }

  function handleBack() {
    const idx = wizardSteps.findIndex((s) => s.id === stepId);
    const prev = wizardSteps[idx - 1];
    if (prev) {
      setSlideDirection("right");
      setStepId(prev.id as StepId);
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
        kind: state.campaignKind,
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

      // Apply consultant notification settings from the wizard's Notifications step.
      // createCampaign already seeds consultant_emails with the creator's email, but the
      // wizard can override that and the two toggles. Best-effort: a failure here doesn't
      // block the campaign from launching (the user can fix it in settings).
      try {
        await updateCampaignConsultantSettings(campaignId, {
          emails: state.notifications.emails,
          enabled: state.notifications.enabled,
          includeSummary: state.notifications.includeSummary,
          attachPdf: state.notifications.attachPdf,
        });
      } catch (notifyError) {
        console.error('[quick-launch] consultant settings update failed', notifyError);
      }

      // Apply custom capability selection if the user limited the assessment.
      if (
        state.selectedCapabilityIds !== null &&
        state.selectedCapabilityIds.length > 0
      ) {
        const { getCampaignAssessmentId } = await import("@/app/actions/campaigns");
        const caId = await getCampaignAssessmentId(campaignId, state.selectedAssessmentId);
        if (caId) {
          await saveFactorSelection(caId, state.selectedCapabilityIds);
        }
      }

      let successDetail = "";
      let successDescription: string | undefined;

      // ── 360 branch: set the subject + raters, then (optionally) invite ──────
      if (is360) {
        // The subject is a normal participant who takes the self version. This
        // also emails them their assessment link.
        const subjectResult = await inviteParticipant(campaignId, {
          email: state.subjectEmail.trim(),
          firstName: state.subjectFirstName.trim() || undefined,
          lastName: state.subjectLastName.trim() || undefined,
        });
        if ("error" in subjectResult && subjectResult.error) {
          throw new Error(getErrorMessage(subjectResult.error));
        }
        // If the subject's own assessment email didn't send, the leader has no
        // link — warn the admin (they can copy it from the Subject & Raters tab).
        const subjectEmailFailed =
          "emailSent" in subjectResult && subjectResult.emailSent === false;

        let ratersAdded = 0;
        for (const rater of state.raters) {
          const addResult = await addRater(campaignId, {
            relationship: rater.relationship,
            name: rater.name.trim() || undefined,
            email: rater.email.trim(),
          });
          if ("error" in addResult && addResult.error) {
            throw new Error(getErrorMessage(addResult.error));
          }
          ratersAdded += 1;
        }

        let invitedCount = 0;
        if (state.sendInvitesNow && ratersAdded > 0) {
          const inviteResult = await markApprovedRatersInvited(campaignId);
          if ("error" in inviteResult && inviteResult.error) {
            throw new Error(inviteResult.error);
          }
          invitedCount =
            "emailsSent" in inviteResult &&
            typeof inviteResult.emailsSent === "number"
              ? inviteResult.emailsSent
              : 0;
        }

        successDetail =
          ratersAdded === 0
            ? "subject set — add raters next"
            : state.sendInvitesNow
              ? `${pluralize(invitedCount, "rater")} invited`
              : `${pluralize(ratersAdded, "rater")} added`;
        const notes: string[] = [];
        if (subjectEmailFailed) {
          notes.push(
            "The subject's invite email didn't send — copy their link from the Subject & Raters tab.",
          );
        }
        if (ratersAdded > 0 && !state.sendInvitesNow) {
          notes.push("Send rater invitations from the Subject & Raters tab.");
        }
        if (notes.length > 0) successDescription = notes.join(" ");
      } else if (state.inviteMode === "single") {
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
      } else if (state.inviteMode === "csv") {
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
      } else if (state.inviteMode === "link") {
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
      // 360 campaigns land on the Subject & Raters tab to manage feedback;
      // self campaigns land on the campaign overview.
      router.push(
        is360
          ? `${successBaseHref}/${campaignId}/raters`
          : `${successBaseHref}/${campaignId}`,
      );
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
    <ActionDialog
      open={open}
      onOpenChange={handleOpenChange}
      eyebrow="Quick launch"
      title="New campaign"
      description="Guided setup — takes about a minute."
    >
      <ActionWizard
        steps={wizardSteps}
        currentStepIndex={currentStepIndex}
        onBack={handleBack}
        onNext={handleNext}
        onComplete={handleLaunch}
        onCancel={() => handleOpenChange(false)}
        canAdvance={canAdvance()}
        isSubmitting={isLaunching}
        completeLabel="Launch"
        completeIcon={<Rocket className="size-4" />}
        submittingLabel="Launching..."
        slideDirection={slideDirection}
      >
          {stepId === "type" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                What kind of campaign is this?
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    {
                      value: "self" as const,
                      icon: User,
                      title: "Individual Assessment",
                      blurb: "Each participant takes their own assessment.",
                    },
                    {
                      value: "leadership_360" as const,
                      icon: Users,
                      title: "360 Feedback",
                      blurb:
                        "One subject rated by self plus observers, for development.",
                    },
                  ]
                ).map((opt) => {
                  const Icon = opt.icon;
                  const selected = state.campaignKind === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        setState((s) => ({ ...s, campaignKind: opt.value }))
                      }
                      aria-pressed={selected}
                      className={cn(
                        "flex flex-col items-start gap-1.5 rounded-lg border p-4 text-left transition-colors",
                        selected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/40",
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-5",
                          selected ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                      <span className="text-sm font-semibold">{opt.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {opt.blurb}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {stepId === "campaign" && (
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
                      <SelectValue>
                        {clients.find((c) => c.id === state.clientId)?.name ?? (
                          <span className="text-muted-foreground">Select a client</span>
                        )}
                      </SelectValue>
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

          {stepId === "assessment" && (
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
                          onClick={() => selectAssessment(assessment.id)}
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
                                    {assessment.factorCount === 1
                                          ? "factor"
                                          : "factors"}
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

          {stepId === "capabilities" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
                <div className="font-medium">{campaignTitle || "Untitled campaign"}</div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {selectedClient && <span>{selectedClient.name}</span>}
                  {selectedAssessment && <span>{selectedAssessment.title}</span>}
                </div>
              </div>

              {loadingCapabilities ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  Loading capabilities...
                </div>
              ) : !hasCapabilities ? (
                <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  No capabilities are configured for this assessment yet.
                  Participants will complete it as authored — click Next to
                  continue.
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    By default, participants complete the full assessment. Toggle
                    custom selection to limit which capabilities are measured.
                  </p>
                  <CapabilitySelectionStep
                    mode="factor"
                    assessmentFactors={state.assessmentFactors}
                    selectedIds={state.selectedCapabilityIds}
                    onSelectionChange={(ids) =>
                      setState((s) => ({ ...s, selectedCapabilityIds: ids }))
                    }
                    itemSelectionRules={state.itemSelectionRules}
                  />
                </>
              )}
            </div>
          )}

          {stepId === "notifications" && (
            <NotificationsStep
              value={state.notifications}
              onChange={(next) =>
                setState((s) => ({ ...s, notifications: next }))
              }
            />
          )}

          {stepId === "invite" && (
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
                    value: "link" as const,
                    label: "Access link",
                    description: "Share a URL",
                    icon: Link2,
                    recommended: true,
                  },
                  {
                    value: "single" as const,
                    label: "Single email",
                    description: "Invite one person",
                    icon: Mail,
                    recommended: false,
                  },
                  {
                    value: "csv" as const,
                    label: "Paste CSV",
                    description: "Bulk invite",
                    icon: FileText,
                    recommended: false,
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
                        "relative flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-colors",
                        selected
                          ? "border-primary bg-primary/5"
                          : mode.recommended
                            ? "border-primary/40 hover:border-primary/60 hover:bg-primary/5"
                            : "border-border hover:border-border/80 hover:bg-muted/40",
                      )}
                    >
                      {mode.recommended && !selected && (
                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2 py-0.5 text-[9px] font-semibold text-primary-foreground">
                          Recommended
                        </span>
                      )}
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
                        ? "text-amber-700"
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

          {stepId === "subject" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Who is being assessed? This leader takes the self version; their
                raters give observer feedback.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ql-subject-first">First name</Label>
                  <Input
                    id="ql-subject-first"
                    placeholder="Jane"
                    value={state.subjectFirstName}
                    onChange={(e) =>
                      setState((s) => ({ ...s, subjectFirstName: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ql-subject-last">Last name</Label>
                  <Input
                    id="ql-subject-last"
                    placeholder="Doe"
                    value={state.subjectLastName}
                    onChange={(e) =>
                      setState((s) => ({ ...s, subjectLastName: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="ql-subject-email">
                    Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="ql-subject-email"
                    type="email"
                    placeholder="leader@company.com"
                    value={state.subjectEmail}
                    onChange={(e) =>
                      setState((s) => ({ ...s, subjectEmail: e.target.value }))
                    }
                  />
                  {subjectEmailError && (
                    <p className="text-xs text-destructive">{subjectEmailError}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {stepId === "raters" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Add the subject&apos;s manager, peers, and direct reports. You can
                always add more later. Peer and direct-report scores show only when
                at least 3 people in a group respond.
              </p>

              <div className="grid gap-2 sm:grid-cols-[9rem_1fr_1fr_auto] sm:items-end">
                <div className="space-y-1.5">
                  <Label className="text-xs">Relationship</Label>
                  <Select
                    value={state.raterRelationship}
                    onValueChange={(v) =>
                      setState((s) => ({
                        ...s,
                        raterRelationship: (v as RaterRelationship) ?? "peer",
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OBSERVER_RELATIONSHIPS.map((rel) => (
                        <SelectItem key={rel.value} value={rel.value}>
                          {rel.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Name</Label>
                  <Input
                    placeholder="Optional"
                    value={state.raterName}
                    onChange={(e) =>
                      setState((s) => ({ ...s, raterName: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Email</Label>
                  <Input
                    type="email"
                    placeholder="rater@company.com"
                    value={state.raterEmail}
                    onChange={(e) =>
                      setState((s) => ({ ...s, raterEmail: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addRaterDraft();
                      }
                    }}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addRaterDraft}
                  disabled={!isValidEmail(state.raterEmail) || !!raterEmailError}
                >
                  <Plus className="size-4" />
                  Add
                </Button>
              </div>
              {raterEmailError && (
                <p className="text-xs text-destructive">{raterEmailError}</p>
              )}

              {state.raters.length > 0 && (
                <div className="divide-y rounded-lg border">
                  {state.raters.map((r, i) => (
                    <div key={`${r.email}-${i}`} className="flex items-center gap-3 p-2.5">
                      <Badge variant="outline" className="shrink-0">
                        {RELATIONSHIP_LABELS[r.relationship] ?? r.relationship}
                      </Badge>
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {r.name ? `${r.name} · ` : ""}
                        {r.email}
                      </span>
                      <button
                        type="button"
                        aria-label="Remove rater"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => removeRaterDraft(i)}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <label className="flex items-center justify-between rounded-lg border border-border p-3">
                <span className="text-sm">
                  Email invitations now
                  <span className="block text-xs text-muted-foreground">
                    Otherwise send them later from the Subject &amp; Raters tab.
                  </span>
                </span>
                <Switch
                  checked={state.sendInvitesNow}
                  onCheckedChange={(v) =>
                    setState((s) => ({ ...s, sendInvitesNow: v === true }))
                  }
                />
              </label>
            </div>
          )}
      </ActionWizard>
    </ActionDialog>
  );
}
