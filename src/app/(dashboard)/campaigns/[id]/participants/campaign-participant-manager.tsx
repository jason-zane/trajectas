"use client";

import { useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  Plus,
  Upload,
  Trash2,
  Copy,
  Mail,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  inviteParticipant,
  bulkInviteParticipants,
  removeParticipant,
  sendParticipantInviteEmail,
} from "@/app/actions/campaigns";
import type { CampaignParticipant } from "@/types/database";

const statusVariant: Record<string, "secondary" | "default" | "outline" | "destructive"> = {
  invited: "secondary",
  registered: "outline",
  in_progress: "default",
  completed: "default",
  withdrawn: "destructive",
  expired: "outline",
};

export function CampaignParticipantManager({
  campaignId,
  participants,
}: {
  campaignId: string;
  participants: CampaignParticipant[];
}) {
  const [showInvite, setShowInvite] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [csvText, setCsvText] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [errors, setErrors] = useState<Record<string, any>>({});

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const result = await inviteParticipant(campaignId, {
      email,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
    });

    if ("error" in result && result.error) {
      setErrors(result.error);
      return;
    }

    toast.success(`Invited ${email}`);
    setEmail("");
    setFirstName("");
    setLastName("");
    setShowInvite(false);
  }

  async function handleBulkUpload() {
    const lines = csvText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const parsed = lines.map((line) => {
      const [email, firstName, lastName] = line.split(",").map((s) => s.trim());
      return { email, firstName, lastName };
    });

    const result = await bulkInviteParticipants(campaignId, parsed);

    if ("error" in result && result.error) {
      toast.error(typeof result.error === 'string' ? result.error : 'Upload failed');
      return;
    }

    toast.success(`Invited ${result.count} participants`);
    setCsvText("");
    setShowBulk(false);
  }

  async function handleRemove(participantId: string, name: string) {
    const result = await removeParticipant(campaignId, participantId);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`Removed ${name}`);
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/assess/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Assessment link copied");
  }

  async function handleSendEmail(participantId: string, email: string) {
    const result = await sendParticipantInviteEmail(campaignId, participantId);
    if (!result.success) {
      toast.error(result.error ?? "Failed to send invite email");
      return;
    }
    toast.success(`Invite sent to ${email}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">
          {participants.length}{" "}
          {participants.length === 1 ? "participant" : "participants"}
        </h3>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowBulk(true)}
          >
            <Upload className="size-4" />
            Bulk Import
          </Button>
          <Button size="sm" onClick={() => setShowInvite(true)}>
            <Plus className="size-4" />
            Invite
          </Button>
        </div>
      </div>

      {participants.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No participants invited yet. Add participants to this campaign.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {participants.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex items-center gap-3 py-3">
                <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                  {(c.firstName?.[0] ?? c.email[0]).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {c.firstName || c.lastName
                      ? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim()
                      : c.email}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {c.email}
                  </p>
                </div>
                <Badge
                  variant={statusVariant[c.status] ?? "secondary"}
                  className="text-[10px]"
                >
                  {c.status.replace("_", " ")}
                </Badge>
                <Link href={`/participants/${c.id}`}>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    title="View participant detail"
                  >
                    <ExternalLink className="size-3.5" />
                  </Button>
                </Link>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  title="Copy assessment link"
                  onClick={() => copyLink(c.accessToken)}
                >
                  <Copy className="size-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  title={c.status === "invited" ? "Send invite email" : "Resend invite email"}
                  onClick={() => handleSendEmail(c.id, c.email)}
                >
                  <Mail className="size-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    handleRemove(
                      c.id,
                      c.firstName
                        ? `${c.firstName} ${c.lastName ?? ""}`.trim()
                        : c.email,
                    )
                  }
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Single invite dialog */}
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
                onChange={(e) => setEmail(e.target.value)}
                placeholder="participant@example.com"
                required
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email[0]}</p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="invite-first">First Name</Label>
                <Input
                  id="invite-first"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-last">Last Name</Label>
                <Input
                  id="invite-last"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
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

      {/* Bulk import dialog */}
      <Dialog open={showBulk} onOpenChange={setShowBulk}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Import Participants</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Paste CSV rows: <code>email, first_name, last_name</code> (one
              per line). First name and last name are optional.
            </p>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={8}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
              placeholder={"jane@example.com, Jane, Doe\njohn@example.com, John, Smith"}
            />
            <Button onClick={handleBulkUpload} className="w-full">
              <Upload className="size-4" />
              Import Participants
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
