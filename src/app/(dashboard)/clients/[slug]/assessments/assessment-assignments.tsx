"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ClipboardCheck,
  Infinity as InfinityIcon,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import {
  assignAssessment,
  updateAssessmentAssignment,
  removeAssessmentAssignment,
} from "@/app/actions/client-entitlements";
import type { AssessmentAssignmentWithUsage } from "@/types/database";
import type { AssessmentWithMeta } from "@/app/actions/assessments";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollReveal } from "@/components/scroll-reveal";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AssessmentAssignmentsProps {
  clientId: string;
  assignments: AssessmentAssignmentWithUsage[];
  allAssessments: AssessmentWithMeta[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AssessmentAssignments({
  clientId,
  assignments,
  allAssessments,
}: AssessmentAssignmentsProps) {
  const router = useRouter();

  // Assign dialog state
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<
    string | null
  >(null);
  const [quotaInput, setQuotaInput] = useState("");
  const [unlimited, setUnlimited] = useState(true);
  const [isAssigning, startAssign] = useTransition();

  // Deactivate dialog state
  const [deactivateTarget, setDeactivateTarget] =
    useState<AssessmentAssignmentWithUsage | null>(null);
  const [isDeactivating, startDeactivate] = useTransition();

  // Inline-edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const [isSavingQuota, startSaveQuota] = useTransition();

  // Filter available assessments (exclude already-assigned ones)
  const assignedIds = new Set(assignments.map((a) => a.assessmentId));
  const availableAssessments = allAssessments.filter(
    (a) => !assignedIds.has(a.id) && a.status === "active"
  );

  // ----- Handlers -----

  function handleOpenAssignDialog() {
    setSelectedAssessmentId(null);
    setQuotaInput("");
    setUnlimited(true);
    setAssignOpen(true);
  }

  function handleAssign() {
    if (!selectedAssessmentId) return;

    const quotaLimit = unlimited ? null : Number(quotaInput) || null;

    startAssign(async () => {
      const result = await assignAssessment(clientId, {
        assessmentId: selectedAssessmentId,
        quotaLimit,
      });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Assessment assigned");
      setAssignOpen(false);
      router.refresh();
    });
  }

  function handleDeactivate() {
    if (!deactivateTarget) return;

    startDeactivate(async () => {
      const result = await removeAssessmentAssignment(
        deactivateTarget.id,
        clientId
      );

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Assessment assignment removed");
      setDeactivateTarget(null);
      router.refresh();
    });
  }

  function startQuotaEdit(assignment: AssessmentAssignmentWithUsage) {
    setEditingId(assignment.id);
    setEditValue(
      assignment.quotaLimit !== null ? String(assignment.quotaLimit) : ""
    );
    // Focus after render
    requestAnimationFrame(() => editInputRef.current?.focus());
  }

  function saveQuota(assignmentId: string) {
    const newLimit = editValue.trim() === "" ? null : Number(editValue);
    if (newLimit !== null && (isNaN(newLimit) || newLimit < 0)) {
      toast.error("Quota must be a positive number or empty for unlimited");
      return;
    }

    startSaveQuota(async () => {
      const result = await updateAssessmentAssignment(
        assignmentId,
        clientId,
        { quotaLimit: newLimit }
      );

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success(
        newLimit !== null ? `Quota updated to ${newLimit}` : "Quota set to unlimited"
      );
      setEditingId(null);
      router.refresh();
    });
  }

  function handleQuotaKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    assignmentId: string
  ) {
    if (e.key === "Enter") {
      e.preventDefault();
      saveQuota(assignmentId);
    } else if (e.key === "Escape") {
      setEditingId(null);
    }
  }

  // ----- Render -----

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-section">Assigned Assessments</h2>
          <p className="text-caption mt-0.5">
            Manage which assessments this client can use in their campaigns.
          </p>
        </div>
        <Button onClick={handleOpenAssignDialog}>
          <Plus data-icon="inline-start" />
          Assign Assessment
        </Button>
      </div>

      {/* Empty state */}
      {assignments.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardCheck className="mx-auto size-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">
              No assessments assigned. Use the button above to assign
              assessments this client can use.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Assignment cards */}
      <div className="space-y-3">
        {assignments.map((assignment, index) => {
          const isUnlimited = assignment.quotaLimit === null;
          const percentUsed = isUnlimited
            ? 0
            : assignment.quotaLimit! > 0
              ? (assignment.quotaUsed / assignment.quotaLimit!) * 100
              : 100;
          const remaining = isUnlimited
            ? null
            : Math.max(0, assignment.quotaLimit! - assignment.quotaUsed);
          const isLow =
            !isUnlimited &&
            remaining !== null &&
            assignment.quotaLimit! > 0 &&
            remaining / assignment.quotaLimit! <= 0.1;

          return (
            <ScrollReveal key={assignment.id} delay={index * 60}>
              <Card>
                <CardHeader className="flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                    >
                      <ClipboardCheck className="size-4" />
                    </div>
                    <CardTitle className="truncate">
                      {assignment.assessmentName}
                    </CardTitle>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => startQuotaEdit(assignment)}
                      aria-label="Edit quota"
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeactivateTarget(assignment)}
                      aria-label="Remove assignment"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="space-y-2">
                    {/* Quota display / inline edit */}
                    <div className="flex items-center gap-3">
                      {editingId === assignment.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground whitespace-nowrap">
                            Quota:
                          </span>
                          <Input
                            ref={editInputRef}
                            type="number"
                            min={0}
                            placeholder="Unlimited"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => saveQuota(assignment.id)}
                            onKeyDown={(e) =>
                              handleQuotaKeyDown(e, assignment.id)
                            }
                            disabled={isSavingQuota}
                            className="h-7 w-28 text-sm"
                          />
                          <span className="text-caption">
                            Leave empty for unlimited
                          </span>
                        </div>
                      ) : (
                        <p
                          className={`text-sm tabular-nums ${isLow ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground"}`}
                        >
                          {isUnlimited ? (
                            <span className="inline-flex items-center gap-1.5">
                              {assignment.quotaUsed} used
                              <span className="text-muted-foreground/60">
                                &middot;
                              </span>
                              <span className="inline-flex items-center gap-0.5">
                                <InfinityIcon className="size-3.5" />
                                unlimited
                              </span>
                            </span>
                          ) : (
                            <span>
                              {assignment.quotaUsed} / {assignment.quotaLimit}{" "}
                              used
                              {isLow && remaining !== null && (
                                <span className="ml-1.5 text-xs">
                                  ({remaining} remaining)
                                </span>
                              )}
                            </span>
                          )}
                        </p>
                      )}
                    </div>

                    {/* Progress bar (only for limited quotas) */}
                    {!isUnlimited && editingId !== assignment.id && (
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isLow
                              ? "bg-amber-500 dark:bg-amber-400"
                              : "bg-primary"
                          }`}
                          style={{
                            width: `${Math.min(100, percentUsed)}%`,
                          }}
                        />
                      </div>
                    )}

                    {/* Date info */}
                    <p className="text-caption">
                      Assigned{" "}
                      {new Date(assignment.created_at).toLocaleDateString(
                        undefined,
                        {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        }
                      )}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>
          );
        })}
      </div>

      {/* Assign Assessment Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Assessment</DialogTitle>
            <DialogDescription>
              Choose an assessment to make available for this client&apos;s
              campaigns.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Assessment picker */}
            <div className="space-y-2">
              <Label>Assessment</Label>
              {availableAssessments.length > 0 ? (
                <Select
                  value={selectedAssessmentId}
                  onValueChange={(val) =>
                    setSelectedAssessmentId(val as string)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select an assessment..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {availableAssessments.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.title}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-3 text-center">
                  All active assessments have already been assigned.
                </p>
              )}
            </div>

            {/* Quota input */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="quota-limit">Quota Limit</Label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={unlimited}
                    onCheckedChange={(val) => setUnlimited(val as boolean)}
                  />
                  Unlimited
                </label>
              </div>
              {!unlimited && (
                <Input
                  id="quota-limit"
                  type="number"
                  min={1}
                  placeholder="e.g. 100"
                  value={quotaInput}
                  onChange={(e) => setQuotaInput(e.target.value)}
                />
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={!selectedAssessmentId || isAssigning}
            >
              {isAssigning ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirmation */}
      <ConfirmDialog
        open={deactivateTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeactivateTarget(null);
        }}
        title="Remove Assessment Assignment"
        description={`This will remove "${deactivateTarget?.assessmentName}" from this client. Existing campaigns using it won't be affected, but new campaigns can no longer use it.`}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={handleDeactivate}
        loading={isDeactivating}
      />
    </div>
  );
}
