"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { toast } from "sonner";
import { FileBarChart, Link2, Mail, Plus, Trash2, Upload } from "lucide-react";

import {
  bulkInviteParticipants,
  inviteParticipant,
  removeParticipant,
  restoreParticipant,
  sendParticipantInviteEmail,
  type BulkInviteEmailFailure,
  type BulkInvitePendingExisting,
  type BulkInviteRowError,
} from "@/app/actions/campaigns";
import { bulkDeleteParticipants } from "@/app/actions/participants";
import type { CampaignParticipant } from "@/types/database";
import {
  DataTable,
  DataTableColumnHeader,
  DataTableRowActions,
} from "@/components/data-table";
import type { BulkAction } from "@/components/data-table/data-table-bulk-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ActionDialog,
  ActionDialogBody,
  ActionDialogFooter,
} from "@/components/action-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STATUS_VARIANT: Record<
  string,
  "secondary" | "default" | "outline" | "destructive"
> = {
  invited: "secondary",
  registered: "outline",
  in_progress: "default",
  completed: "default",
  withdrawn: "destructive",
  expired: "outline",
};

function getDisplayName(participant: CampaignParticipant) {
  const name = `${participant.firstName ?? ""} ${participant.lastName ?? ""}`.trim();
  return name || participant.email;
}

export function CampaignParticipantManager({
  campaignId,
  participants,
}: {
  campaignId: string;
  participants: CampaignParticipant[];
}) {
  const router = useRouter();
  const [showInvite, setShowInvite] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [csvText, setCsvText] = useState("");
  const [showBulkErrors, setShowBulkErrors] = useState(false);
  const [bulkErrors, setBulkErrors] = useState<BulkInviteRowError[]>([]);
  const [bulkEmailFailures, setBulkEmailFailures] = useState<
    BulkInviteEmailFailure[]
  >([]);
  const [pendingDuplicateRows, setPendingDuplicateRows] = useState<
    BulkInvitePendingExisting[]
  >([]);
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [errors, setErrors] = useState<Record<string, any>>({});

  async function handleInvite(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});

    const invitedEmail = email;
    const result = await inviteParticipant(campaignId, {
      email: invitedEmail,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
    });

    if ("error" in result && result.error) {
      setErrors(result.error);
      return;
    }

    setEmail("");
    setFirstName("");
    setLastName("");
    setShowInvite(false);

    if (result.emailSent) {
      toast.success(`Invited ${invitedEmail}`);
    } else {
      const participantId = result.id;
      toast.warning(`${invitedEmail} added but email failed to send`, {
        description: result.emailError,
        action: {
          label: "Retry email",
          onClick: async () => {
            const retry = await sendParticipantInviteEmail(campaignId, participantId);
            if (retry.success) {
              toast.success(`Invite sent to ${invitedEmail}`);
            } else {
              toast.error(retry.error ?? "Email still failed");
            }
          },
        },
        duration: 10000,
      });
    }

    router.refresh();
  }

  async function handleBulkUpload() {
    const lines = csvText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const parsed = lines.map((line) => {
      const [emailValue, firstNameValue, lastNameValue] = line
        .split(",")
        .map((segment) => segment.trim());
      return {
        email: emailValue,
        firstName: firstNameValue,
        lastName: lastNameValue,
      };
    });

    const result = await bulkInviteParticipants(campaignId, parsed);

    if ("error" in result && result.error) {
      toast.error(typeof result.error === "string" ? result.error : "Upload failed");
      return;
    }

    if (!("success" in result) || !result.success) {
      toast.error("Upload failed");
      return;
    }

    const summary = [
      result.inserted > 0
        ? `${result.inserted} participant${result.inserted === 1 ? "" : "s"} invited`
        : "No new participants invited",
      result.existingCount > 0
        ? `${result.existingCount} already existed`
        : null,
      result.errors.length > 0
        ? `${result.errors.length} invalid row${result.errors.length === 1 ? "" : "s"}`
        : null,
      result.emailFailures.length > 0
        ? `${result.emailFailures.length} email delivery failure${
            result.emailFailures.length === 1 ? "" : "s"
          }`
        : null,
    ]
      .filter(Boolean)
      .join(", ");

    if (result.emailFailures.length > 0) {
      toast.warning(summary, {
        description:
          "Some participants were added, but their invite emails need to be retried from the participant table.",
      });
    } else {
      toast.success(summary);
    }

    if (result.errors.length > 0 || result.emailFailures.length > 0) {
      setBulkErrors(result.errors);
      setBulkEmailFailures(result.emailFailures);
      setShowBulkErrors(true);
    } else {
      setBulkErrors([]);
      setBulkEmailFailures([]);
    }
    if (result.requiresConfirmation && result.pendingExisting.length > 0) {
      setPendingDuplicateRows(result.pendingExisting);
      setShowDuplicateConfirm(true);
    } else {
      setPendingDuplicateRows([]);
    }

    setCsvText("");
    setShowBulk(false);
    router.refresh();
  }

  async function handleConfirmDuplicateInvites() {
    const result = await bulkInviteParticipants(campaignId, pendingDuplicateRows, {
      allowExisting: true,
    });

    if ("error" in result && result.error) {
      toast.error(typeof result.error === "string" ? result.error : "Retake invite failed");
      return;
    }

    if (!("success" in result) || !result.success) {
      toast.error("Retake invite failed");
      return;
    }

    if (result.emailFailures.length > 0) {
      toast.warning(
        `${result.inserted} retake invite${
          result.inserted === 1 ? "" : "s"
        } created, ${result.emailFailures.length} email${
          result.emailFailures.length === 1 ? "" : "s"
        } failed`,
      );
      setBulkErrors([]);
      setBulkEmailFailures(result.emailFailures);
      setShowBulkErrors(true);
    } else {
      setBulkErrors([]);
      setBulkEmailFailures([]);
      toast.success(
        `${result.inserted} retake invite${result.inserted === 1 ? "" : "s"} created`,
      );
    }
    setPendingDuplicateRows([]);
    setShowDuplicateConfirm(false);
    router.refresh();
  }

  async function handleRemove(participantId: string, name: string) {
    const result = await removeParticipant(campaignId, participantId);
    if (result?.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Participant removed", {
      action: {
        label: "Undo",
        onClick: async () => {
          const restoreResult = await restoreParticipant(campaignId, participantId);
          if (restoreResult?.error) {
            toast.error(restoreResult.error);
            return;
          }

          toast.success(`${name} restored`);
          router.refresh();
        },
      },
      duration: 5000,
    });
    router.refresh();
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/assess/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Assessment link copied");
  }

  async function handleSendEmail(participantId: string, emailAddress: string) {
    const result = await sendParticipantInviteEmail(campaignId, participantId);
    if (!result.success) {
      toast.error(result.error ?? "Failed to send invite email");
      return;
    }

    toast.success(`Invite sent to ${emailAddress}`);
  }

  const rows = participants.map((participant) => ({
    ...participant,
    displayName: getDisplayName(participant),
    /** Pick the most recent participant_session ID (if any) */
    latestSessionId: participant.participantSessions
      ?.slice()
      .reverse()
      .find((s) => s.status === "completed" || s.status === "in_progress")?.id
      ?? participant.participantSessions?.[participant.participantSessions.length - 1]?.id,
  }));

  type Row = (typeof rows)[number];

  const bulkActions: BulkAction<Row>[] = [
    {
      label: "Remove",
      variant: "destructive",
      icon: <Trash2 className="mr-1.5 h-3.5 w-3.5" />,
      action: async (ids) => {
        try {
          await bulkDeleteParticipants(ids);
          toast.success(
            `Removed ${ids.length} participant${ids.length === 1 ? "" : "s"}`,
          );
          router.refresh();
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : "Failed to remove participants.",
          );
        }
      },
    },
  ];

  const columns: ColumnDef<Row>[] = [
    {
      accessorKey: "displayName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Participant" />
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
            {(row.original.firstName?.[0] ?? row.original.email[0]).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium">{row.original.displayName}</p>
            <p className="truncate text-sm text-muted-foreground">{row.original.email}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => (
        <Badge variant={STATUS_VARIANT[row.original.status] ?? "secondary"}>
          {row.original.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      id: "startedAt",
      accessorFn: (row) => row.startedAt ?? "",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Started" />
      ),
      cell: ({ row }) =>
        row.original.startedAt ? (
          <span className="text-sm text-muted-foreground">
            {new Date(row.original.startedAt).toLocaleDateString("en-AU", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      id: "completedAt",
      accessorFn: (row) => row.completedAt ?? "",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Completed" />
      ),
      cell: ({ row }) =>
        row.original.completedAt ? (
          <span className="text-sm text-muted-foreground">
            {new Date(row.original.completedAt).toLocaleDateString("en-AU", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      id: "viewResults",
      enableSorting: false,
      header: () => <span className="text-xs text-muted-foreground">Results</span>,
      cell: ({ row }) => {
        const canView = ["in_progress", "completed"].includes(row.original.status) && row.original.latestSessionId;
        if (canView) {
          return (
            <Link href={`/campaigns/${campaignId}/sessions/${row.original.latestSessionId}`}>
              <Button size="sm" variant="ghost">
                <FileBarChart className="size-4" />
                View Results
              </Button>
            </Link>
          );
        }
        return (
          <Button size="sm" variant="ghost" disabled className="opacity-50">
            <FileBarChart className="size-4" />
            View Results
          </Button>
        );
      },
    },
    {
      id: "actions",
      enableSorting: false,
      cell: ({ row }) => (
        <DataTableRowActions>
          <Button
            size="icon-sm"
            variant="ghost"
            title="Copy assessment link"
            onClick={() => copyLink(row.original.accessToken)}
          >
            <Link2 className="size-4" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            title={
              row.original.status === "invited" ? "Send invite email" : "Resend invite email"
            }
            onClick={() => handleSendEmail(row.original.id, row.original.email)}
          >
            <Mail className="size-4" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => handleRemove(row.original.id, row.original.displayName)}
          >
            <Trash2 className="size-4" />
          </Button>
        </DataTableRowActions>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">
          {participants.length} {participants.length === 1 ? "participant" : "participants"}
        </h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowBulk(true)}>
            <Upload className="size-4" />
            Bulk Import
          </Button>
          <Button size="sm" onClick={() => setShowInvite(true)}>
            <Plus className="size-4" />
            Invite
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        searchableColumns={["displayName", "email"]}
        searchPlaceholder="Search participants"
        defaultSort={{ id: "displayName", desc: false }}
        pageSize={20}
        enableRowSelection
        bulkActions={bulkActions}
      />

      <ActionDialog
        open={showInvite}
        onOpenChange={setShowInvite}
        eyebrow="Invite"
        title="Invite participant"
        description="Send an assessment invitation directly to one person."
      >
        <form
          onSubmit={handleInvite}
          className="flex min-h-0 flex-1 flex-col"
        >
          <ActionDialogBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="participant@example.com"
                required
                autoFocus
              />
              {errors.email ? (
                <p className="text-xs text-destructive">{errors.email[0]}</p>
              ) : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="invite-first">First name</Label>
                <Input
                  id="invite-first"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-last">Last name</Label>
                <Input
                  id="invite-last"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                />
              </div>
            </div>
          </ActionDialogBody>
          <ActionDialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowInvite(false)}
            >
              Cancel
            </Button>
            <Button type="submit">
              <Mail className="size-4" />
              Send invite
            </Button>
          </ActionDialogFooter>
        </form>
      </ActionDialog>

      <ActionDialog
        open={showBulk}
        onOpenChange={setShowBulk}
        eyebrow="Bulk invite"
        title="Bulk import participants"
        description={
          <>
            Paste CSV rows — one per line. Format:{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
              email, first_name, last_name
            </code>
            . First and last name are optional.
          </>
        }
      >
        <ActionDialogBody>
          <textarea
            value={csvText}
            onChange={(event) => setCsvText(event.target.value)}
            rows={10}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder={"jane@example.com, Jane, Doe\njohn@example.com, John, Smith"}
          />
        </ActionDialogBody>
        <ActionDialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowBulk(false)}
          >
            Cancel
          </Button>
          <Button onClick={handleBulkUpload}>
            <Upload className="size-4" />
            Import participants
          </Button>
        </ActionDialogFooter>
      </ActionDialog>

      <ActionDialog
        open={showBulkErrors}
        onOpenChange={setShowBulkErrors}
        eyebrow="Bulk invite"
        title="Import issues"
        description="Review the rows that were rejected and any invite emails that need to be retried from the participant table."
      >
        <ActionDialogBody className="space-y-4">
          {bulkErrors.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Rows not imported</p>
              <div className="space-y-2">
                {bulkErrors.map((error) => (
                  <div
                    key={`${error.row}-${error.email ?? error.message}`}
                    className="rounded-lg border border-border bg-muted/30 px-3 py-2"
                  >
                    <p className="text-sm font-medium">
                      Row {error.row}
                      {error.email ? ` · ${error.email}` : ""}
                    </p>
                    <p className="text-sm text-muted-foreground">{error.message}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {bulkEmailFailures.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Invite emails that failed</p>
              <div className="space-y-2">
                {bulkEmailFailures.map((failure) => (
                  <div
                    key={`${failure.participantId}-${failure.email}`}
                    className="rounded-lg border border-border bg-muted/30 px-3 py-2"
                  >
                    <p className="text-sm font-medium">{failure.email}</p>
                    <p className="text-sm text-muted-foreground">{failure.error}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </ActionDialogBody>
        <ActionDialogFooter>
          <div />
          <Button onClick={() => setShowBulkErrors(false)}>Close</Button>
        </ActionDialogFooter>
      </ActionDialog>

      <ConfirmDialog
        open={showDuplicateConfirm}
        onOpenChange={setShowDuplicateConfirm}
        title="Create retake invites for existing participants?"
        description={`${pendingDuplicateRows.length} uploaded email${
          pendingDuplicateRows.length === 1 ? "" : "s"
        } already exist in this campaign.`}
        confirmLabel="Create retake invites"
        onConfirm={handleConfirmDuplicateInvites}
        details={
          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4 text-sm">
            <p className="text-muted-foreground">
              Continuing will create additional participant records for these existing emails.
            </p>
            <div className="space-y-2">
              {pendingDuplicateRows.slice(0, 5).map((participant) => (
                <p key={`${participant.row}-${participant.email}`} className="font-medium text-foreground">
                  Row {participant.row} · {participant.email}
                </p>
              ))}
              {pendingDuplicateRows.length > 5 && (
                <p className="text-muted-foreground">
                  And {pendingDuplicateRows.length - 5} more.
                </p>
              )}
            </div>
          </div>
        }
      />
    </div>
  );
}
