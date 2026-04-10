"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { toast } from "sonner";
import { Copy, ExternalLink, Mail, Plus, Trash2, Upload } from "lucide-react";

import {
  bulkInviteParticipants,
  inviteParticipant,
  removeParticipant,
  restoreParticipant,
  sendParticipantInviteEmail,
  type BulkInvitePendingExisting,
  type BulkInviteRowError,
} from "@/app/actions/campaigns";
import type { CampaignParticipant } from "@/types/database";
import {
  DataTable,
  DataTableColumnHeader,
  DataTableRowActions,
} from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CampaignParticipantRow = CampaignParticipant & {
  displayName: string;
};

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
    ]
      .filter(Boolean)
      .join(", ");

    toast.success(summary);

    if (result.errors.length > 0) {
      setBulkErrors(result.errors);
      setShowBulkErrors(true);
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

    toast.success(
      `${result.inserted} retake invite${result.inserted === 1 ? "" : "s"} created`,
    );
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
  }));

  const columns: ColumnDef<CampaignParticipantRow>[] = [
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
      id: "actions",
      enableSorting: false,
      cell: ({ row }) => (
        <DataTableRowActions>
          <Link href={`/participants/${row.original.id}`}>
            <Button
              size="icon-sm"
              variant="ghost"
              title="View participant detail"
            >
              <ExternalLink className="size-4" />
            </Button>
          </Link>
          <Button
            size="icon-sm"
            variant="ghost"
            title="Copy assessment link"
            onClick={() => copyLink(row.original.accessToken)}
          >
            <Copy className="size-4" />
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
      />

      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Participant</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="participant@example.com"
                required
              />
              {errors.email ? (
                <p className="text-xs text-destructive">{errors.email[0]}</p>
              ) : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="invite-first">First Name</Label>
                <Input
                  id="invite-first"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-last">Last Name</Label>
                <Input
                  id="invite-last"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                />
              </div>
            </div>
            <Button type="submit" className="w-full">
              <Mail className="size-4" />
              Send Invite
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showBulk} onOpenChange={setShowBulk}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Import Participants</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Paste CSV rows: <code>email, first_name, last_name</code> (one per line). First
              name and last name are optional.
            </p>
            <textarea
              value={csvText}
              onChange={(event) => setCsvText(event.target.value)}
              rows={8}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder={"jane@example.com, Jane, Doe\njohn@example.com, John, Smith"}
            />
            <Button onClick={handleBulkUpload} className="w-full">
              <Upload className="size-4" />
              Import Participants
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showBulkErrors} onOpenChange={setShowBulkErrors}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rows that were not imported</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Fix these rows and re-import them if you still want to invite those participants.
            </p>
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
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
        </DialogContent>
      </Dialog>

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
