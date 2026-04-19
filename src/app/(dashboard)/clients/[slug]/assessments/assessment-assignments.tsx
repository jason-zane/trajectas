"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Infinity as InfinityIcon,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  assignAssessment,
  updateAssessmentAssignment,
  removeAssessmentAssignment,
} from "@/app/actions/client-entitlements";
import type { AssessmentAssignmentWithUsage } from "@/types/database";
import type { AssessmentWithMeta } from "@/app/actions/assessments";

import {
  DataTable,
  DataTableActionsMenu,
  DataTableColumnHeader,
} from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  ActionDialog,
  ActionDialogBody,
  ActionDialogFooter,
} from "@/components/action-dialog";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getSelectLabel } from "@/lib/select-display";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AssessmentAssignmentsProps {
  clientId: string;
  assignments: AssessmentAssignmentWithUsage[];
  allAssessments: AssessmentWithMeta[];
  /** When client belongs to a partner, only these assessment IDs are available. */
  partnerPoolAssessmentIds?: string[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AssessmentAssignments({
  clientId,
  assignments,
  allAssessments,
  partnerPoolAssessmentIds,
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

  // Remove dialog state
  const [removeTarget, setRemoveTarget] =
    useState<AssessmentAssignmentWithUsage | null>(null);
  const [isRemoving, startRemove] = useTransition();

  // Inline-edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const [isSavingQuota, startSaveQuota] = useTransition();

  // Filter available assessments (exclude already-assigned ones)
  // If partnerPoolAssessmentIds is provided, further restrict to partner pool
  const assignedIds = new Set(assignments.map((a) => a.assessmentId));
  const availableAssessments = allAssessments.filter((a) => {
    if (assignedIds.has(a.id)) return false;
    if (a.status !== "active") return false;
    if (partnerPoolAssessmentIds && !partnerPoolAssessmentIds.includes(a.id))
      return false;
    return true;
  });

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

  function handleRemove() {
    if (!removeTarget) return;

    startRemove(async () => {
      const result = await removeAssessmentAssignment(
        removeTarget.id,
        clientId
      );

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Assessment assignment removed");
      setRemoveTarget(null);
      router.refresh();
    });
  }

  function startQuotaEdit(assignment: AssessmentAssignmentWithUsage) {
    setEditingId(assignment.id);
    setEditValue(
      assignment.quotaLimit !== null ? String(assignment.quotaLimit) : ""
    );
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
        newLimit !== null
          ? `Quota updated to ${newLimit}`
          : "Quota set to unlimited"
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

  // ----- Columns -----

  const columns = useMemo<ColumnDef<AssessmentAssignmentWithUsage>[]>(
    () => [
      {
        accessorKey: "assessmentName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Assessment" />
        ),
        cell: ({ row }) => (
          <span className="font-semibold text-foreground">
            {row.original.assessmentName}
          </span>
        ),
      },
      {
        accessorKey: "quotaLimit",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Quota" />
        ),
        cell: ({ row }) => {
          const a = row.original;
          const isUnlimited = a.quotaLimit === null;

          if (editingId === a.id) {
            return (
              <div className="flex items-center gap-2">
                <Input
                  ref={editInputRef}
                  type="number"
                  min={0}
                  placeholder="Unlimited"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => saveQuota(a.id)}
                  onKeyDown={(e) => handleQuotaKeyDown(e, a.id)}
                  disabled={isSavingQuota}
                  className="h-7 w-24 text-sm"
                />
              </div>
            );
          }

          return (
            <span className="tabular-nums text-sm text-muted-foreground">
              {isUnlimited ? (
                <span className="inline-flex items-center gap-1">
                  <InfinityIcon className="size-3.5" />
                  Unlimited
                </span>
              ) : (
                `${a.quotaUsed} / ${a.quotaLimit}`
              )}
            </span>
          );
        },
      },
      {
        id: "usage",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Usage" />
        ),
        accessorFn: (row) => row.quotaUsed,
        cell: ({ row }) => {
          const a = row.original;
          const isUnlimited = a.quotaLimit === null;

          if (isUnlimited) {
            return (
              <span className="tabular-nums text-sm text-muted-foreground">
                {a.quotaUsed} used
              </span>
            );
          }

          const percentUsed =
            a.quotaLimit! > 0
              ? (a.quotaUsed / a.quotaLimit!) * 100
              : 100;

          return (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    percentUsed >= 90
                      ? "bg-amber-500"
                      : "bg-primary"
                  }`}
                  style={{
                    width: `${Math.min(100, percentUsed)}%`,
                  }}
                />
              </div>
              <span className="tabular-nums text-xs text-muted-foreground">
                {Math.round(percentUsed)}%
              </span>
            </div>
          );
        },
      },
      {
        id: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        accessorFn: (row) => {
          if (row.quotaLimit === null) return "healthy";
          const remaining = row.quotaLimit - row.quotaUsed;
          return row.quotaLimit > 0 && remaining / row.quotaLimit <= 0.1
            ? "low"
            : "healthy";
        },
        cell: ({ row }) => {
          const a = row.original;
          const isUnlimited = a.quotaLimit === null;
          const remaining = isUnlimited
            ? null
            : Math.max(0, a.quotaLimit! - a.quotaUsed);
          const isLow =
            !isUnlimited &&
            remaining !== null &&
            a.quotaLimit! > 0 &&
            remaining / a.quotaLimit! <= 0.1;

          return isLow ? (
            <Badge variant="outline" className="text-amber-600 border-amber-300">
              Low quota
            </Badge>
          ) : (
            <Badge variant="outline" className="text-emerald-600 border-emerald-300">
              Healthy
            </Badge>
          );
        },
      },
      {
        accessorKey: "created_at",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Assigned" />
        ),
        cell: ({ row }) => {
          const date = new Date(row.original.created_at);
          const formatted = date.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          });
          const relative = getRelativeTime(date);

          return (
            <Tooltip>
              <TooltipTrigger className="text-sm text-muted-foreground cursor-default">
                {relative}
              </TooltipTrigger>
              <TooltipContent>{formatted}</TooltipContent>
            </Tooltip>
          );
        },
      },
      {
        id: "actions",
        enableSorting: false,
        cell: ({ row }) => {
          const a = row.original;
          return (
            <DataTableActionsMenu label={`Actions for ${a.assessmentName}`}>
              <DropdownMenuItem onClick={() => startQuotaEdit(a)}>
                <Pencil className="size-4" />
                Edit Quota
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setRemoveTarget(a)}
                variant="destructive"
              >
                <Trash2 className="size-4" />
                Remove
              </DropdownMenuItem>
            </DataTableActionsMenu>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editingId, editValue, isSavingQuota]
  );

  // ----- Render -----

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleOpenAssignDialog}>
          <Plus data-icon="inline-start" />
          Assign Assessment
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={assignments}
        searchableColumns={["assessmentName"]}
        searchPlaceholder="Search assessments"
        defaultSort={{ id: "assessmentName", desc: false }}
        pageSize={20}
      />

      <ActionDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        eyebrow="Client"
        title="Assign assessment"
        description="Choose an assessment to make available for this client's campaigns."
      >
        <ActionDialogBody className="space-y-4">
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
                  <SelectValue placeholder="Select an assessment...">
                    {(value: string | null) =>
                      getSelectLabel(
                        value,
                        availableAssessments.map((assessment) => ({
                          value: assessment.id,
                          label: assessment.title,
                        })),
                        "Select an assessment..."
                      )
                    }
                  </SelectValue>
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
              <p className="rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">
                {partnerPoolAssessmentIds
                  ? "All assessments from the partner pool have been assigned."
                  : "All active assessments have already been assigned."}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="quota-limit">Quota limit</Label>
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
        </ActionDialogBody>
        <ActionDialogFooter>
          <Button variant="ghost" onClick={() => setAssignOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedAssessmentId || isAssigning}
          >
            {isAssigning ? "Assigning..." : "Assign assessment"}
          </Button>
        </ActionDialogFooter>
      </ActionDialog>

      {/* Remove Confirmation */}
      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
        title="Remove Assessment Assignment"
        description={`This will remove "${removeTarget?.assessmentName}" from this client. Existing campaigns using it won't be affected, but new campaigns can no longer use it.`}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={handleRemove}
        loading={isRemoving}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}
