"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, Trash2, Check, X, Send, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { inviteParticipant } from "@/app/actions/campaigns";
import {
  addRater,
  updateRaterStatus,
  removeRater,
  markApprovedRatersInvited,
  type RaterWithProgress,
} from "@/app/actions/raters";
import type {
  CampaignParticipant,
  RaterRelationship,
} from "@/types/database";

const RELATIONSHIP_LABELS: Record<string, string> = {
  manager: "Manager",
  peer: "Peer",
  direct_report: "Direct report",
  other: "Other",
};

const OBSERVER_RELATIONSHIPS: { value: RaterRelationship; label: string }[] = [
  { value: "manager", label: "Manager" },
  { value: "peer", label: "Peer" },
  { value: "direct_report", label: "Direct report" },
  { value: "other", label: "Other" },
];

// Categories that aggregate need ≥3 raters before scores can be shown
// without compromising anonymity (manager is named, so it's exempt).
const ANON_THRESHOLD = 3;

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  approved: "default",
  nominated: "secondary",
  invited: "secondary",
  in_progress: "outline",
  completed: "default",
  declined: "destructive",
  withdrawn: "outline",
  expired: "outline",
};

export function CampaignRatersManager({
  campaignId,
  subject,
  raters,
}: {
  campaignId: string;
  subject: CampaignParticipant | null;
  raters: RaterWithProgress[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // --- Subject form state ---
  const [subjEmail, setSubjEmail] = useState("");
  const [subjFirst, setSubjFirst] = useState("");
  const [subjLast, setSubjLast] = useState("");

  // --- Rater form state ---
  const [relationship, setRelationship] = useState<RaterRelationship>("peer");
  const [raterName, setRaterName] = useState("");
  const [raterEmail, setRaterEmail] = useState("");

  function handleAddSubject() {
    if (!subjEmail.trim()) {
      toast.error("Enter the subject's email");
      return;
    }
    startTransition(async () => {
      const res = await inviteParticipant(campaignId, {
        email: subjEmail.trim(),
        firstName: subjFirst.trim() || undefined,
        lastName: subjLast.trim() || undefined,
      });
      if ("error" in res && res.error) {
        toast.error("Could not set the subject");
        return;
      }
      toast.success("Subject set");
      setSubjEmail("");
      setSubjFirst("");
      setSubjLast("");
      router.refresh();
    });
  }

  function handleAddRater() {
    if (!raterEmail.trim()) {
      toast.error("Enter the rater's email");
      return;
    }
    startTransition(async () => {
      const res = await addRater(campaignId, {
        relationship,
        name: raterName.trim() || undefined,
        email: raterEmail.trim(),
      });
      if ("error" in res && res.error) {
        const msg =
          typeof res.error === "object" && "email" in res.error
            ? (res.error.email?.[0] ?? "Could not add rater")
            : "Could not add rater";
        toast.error(msg);
        return;
      }
      toast.success("Rater added");
      setRaterName("");
      setRaterEmail("");
      router.refresh();
    });
  }

  function handleStatus(
    raterId: string,
    status: "approved" | "declined" | "withdrawn",
  ) {
    startTransition(async () => {
      const res = await updateRaterStatus(campaignId, raterId, status);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }

  function handleRemove(raterId: string) {
    startTransition(async () => {
      const res = await removeRater(campaignId, raterId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Rater removed");
      router.refresh();
    });
  }

  function handleInviteApproved() {
    startTransition(async () => {
      const res = await markApprovedRatersInvited(campaignId);
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      const n = "count" in res && typeof res.count === "number" ? res.count : 0;
      toast.success(
        n > 0
          ? `Invited ${n} ${n === 1 ? "rater" : "raters"}`
          : "No approved raters to invite",
      );
      router.refresh();
    });
  }

  async function copyLink(token: string) {
    const url = `${window.location.origin}/assess/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Survey link copied");
    } catch {
      toast.error("Could not copy link");
    }
  }

  // Readiness: count active (non-declined/withdrawn) raters per category.
  const active = raters.filter(
    (r) => r.status !== "declined" && r.status !== "withdrawn",
  );
  const countBy = (rel: RaterRelationship) =>
    active.filter((r) => r.relationship === rel).length;
  const approvedCount = raters.filter((r) => r.status === "approved").length;

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        eyebrow="360 Feedback"
        title="Subject & Raters"
        description="Set the leader being assessed, then add the raters who will give observer feedback."
      />

      {/* Subject */}
      <Card>
        <CardHeader>
          <CardTitle>Subject</CardTitle>
          <CardDescription>
            The leader being assessed. They take the self version of the
            assessment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {subject ? (
            <div className="flex items-center justify-between rounded-lg border bg-card p-3">
              <div>
                <p className="font-semibold">
                  {[subject.firstName, subject.lastName]
                    .filter(Boolean)
                    .join(" ") || subject.email}
                </p>
                <p className="text-caption text-muted-foreground">
                  {subject.email}
                </p>
              </div>
              <Badge variant="secondary">{subject.status}</Badge>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="subjFirst">First name</Label>
                <Input
                  id="subjFirst"
                  value={subjFirst}
                  onChange={(e) => setSubjFirst(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="subjLast">Last name</Label>
                <Input
                  id="subjLast"
                  value={subjLast}
                  onChange={(e) => setSubjLast(e.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="subjEmail">Email</Label>
                <Input
                  id="subjEmail"
                  type="email"
                  value={subjEmail}
                  onChange={(e) => setSubjEmail(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Button onClick={handleAddSubject} disabled={pending}>
                  <UserPlus className="size-4" />
                  Set subject
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Raters */}
      <Card>
        <CardHeader>
          <CardTitle>Raters</CardTitle>
          <CardDescription>
            Add the subject&apos;s manager, peers, and direct reports. Peer and
            direct-report scores are only shown when at least {ANON_THRESHOLD}{" "}
            people in that group respond, to protect anonymity.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!subject && (
            <Alert variant="info">
              <AlertDescription>
                Set the subject first, then add their raters.
              </AlertDescription>
            </Alert>
          )}

          {subject && (
            <>
              {/* Readiness hints */}
              <div className="flex flex-wrap gap-2">
                {OBSERVER_RELATIONSHIPS.map((rel) => {
                  const n = countBy(rel.value);
                  const needsThreshold =
                    rel.value === "peer" || rel.value === "direct_report";
                  const ok = !needsThreshold || n >= ANON_THRESHOLD;
                  return (
                    <Badge
                      key={rel.value}
                      variant={ok && n > 0 ? "default" : "outline"}
                      className={
                        needsThreshold && n > 0 && n < ANON_THRESHOLD
                          ? "border-amber-500/50 text-amber-600"
                          : undefined
                      }
                    >
                      {rel.label}: {n}
                      {needsThreshold ? `/${ANON_THRESHOLD}` : ""}
                    </Badge>
                  );
                })}
                {approvedCount > 0 && (
                  <Button
                    size="sm"
                    className="ml-auto"
                    disabled={pending}
                    onClick={handleInviteApproved}
                  >
                    <Send className="size-4" />
                    Invite {approvedCount} approved
                  </Button>
                )}
              </div>

              {/* Add rater */}
              <div className="grid gap-3 sm:grid-cols-[10rem_1fr_1fr_auto] sm:items-end">
                <div className="space-y-1.5">
                  <Label>Relationship</Label>
                  <Select
                    value={relationship}
                    onValueChange={(v) =>
                      setRelationship((v as RaterRelationship) ?? "peer")
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
                  <Label htmlFor="raterName">Name</Label>
                  <Input
                    id="raterName"
                    value={raterName}
                    onChange={(e) => setRaterName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="raterEmail">Email</Label>
                  <Input
                    id="raterEmail"
                    type="email"
                    value={raterEmail}
                    onChange={(e) => setRaterEmail(e.target.value)}
                  />
                </div>
                <Button onClick={handleAddRater} disabled={pending}>
                  <UserPlus className="size-4" />
                  Add
                </Button>
              </div>

              {/* Rater list */}
              {raters.length === 0 ? (
                <EmptyState
                  variant="default"
                  size="sm"
                  title="No raters yet"
                  description="Add the subject's manager, peers, and direct reports above."
                />
              ) : (
                <div className="divide-y rounded-lg border">
                  {raters.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-3 p-3"
                    >
                      <Badge variant="outline" className="shrink-0">
                        {RELATIONSHIP_LABELS[r.relationship] ?? r.relationship}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {r.name || r.email}
                        </p>
                        {r.name && (
                          <p className="truncate text-caption text-muted-foreground">
                            {r.email}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant={STATUS_VARIANT[r.effectiveStatus] ?? "secondary"}
                        className="shrink-0"
                      >
                        {r.effectiveStatus.replace(/_/g, " ")}
                      </Badge>
                      <div className="flex shrink-0 gap-1">
                        {r.takingToken && (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Copy survey link"
                            disabled={pending}
                            onClick={() => copyLink(r.takingToken!)}
                          >
                            <Link2 className="size-3.5 text-primary" />
                          </Button>
                        )}
                        {r.status !== "approved" && (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Approve rater"
                            disabled={pending}
                            onClick={() => handleStatus(r.id, "approved")}
                          >
                            <Check className="size-3.5 text-emerald-600" />
                          </Button>
                        )}
                        {r.status !== "declined" && (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Decline rater"
                            disabled={pending}
                            onClick={() => handleStatus(r.id, "declined")}
                          >
                            <X className="size-3.5 text-muted-foreground" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label="Remove rater"
                          disabled={pending}
                          onClick={() => handleRemove(r.id)}
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
