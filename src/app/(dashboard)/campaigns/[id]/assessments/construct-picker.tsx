"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ScrollReveal } from "@/components/scroll-reveal";
import {
  saveConstructSelection,
  clearConstructSelection,
} from "@/app/actions/construct-selection";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConstructPickerProps = {
  campaignAssessmentId: string;
  minCustomConstructs: number;
  currentSelection: { isCustom: boolean; selectedConstructIds: string[] };
  constructsByDimension: Array<{
    dimensionId: string | null;
    dimensionName: string | null;
    constructs: Array<{
      constructId: string;
      constructName: string;
      constructDescription: string | null;
    }>;
  }>;
  itemSelectionRules: Array<{
    minConstructs: number;
    maxConstructs: number | null;
    itemsPerConstruct: number;
  }>;
  hasCompletedParticipants?: boolean;
};

// ---------------------------------------------------------------------------
// Estimate
// ---------------------------------------------------------------------------

function computeEstimate(
  selectedIds: string[],
  rules: ConstructPickerProps["itemSelectionRules"],
) {
  const constructCount = selectedIds.length;
  const rule = rules.find(
    (r) =>
      constructCount >= r.minConstructs &&
      (r.maxConstructs === null || constructCount <= r.maxConstructs),
  );
  const itemsPerConstruct = rule?.itemsPerConstruct ?? 6;
  const estimatedItems = constructCount * itemsPerConstruct;
  const estimatedMinutes = Math.ceil((estimatedItems * 8) / 60);

  return { constructCount, estimatedItems, estimatedMinutes };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConstructPicker({
  campaignAssessmentId,
  minCustomConstructs,
  currentSelection,
  constructsByDimension,
  itemSelectionRules,
  hasCompletedParticipants = false,
}: ConstructPickerProps) {
  const router = useRouter();

  const [isCustom, setIsCustom] = useState(currentSelection.isCustom);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(currentSelection.selectedConstructIds),
  );
  const [saving, setSaving] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [expandedDimensions, setExpandedDimensions] = useState<Set<string>>(
    () => new Set(constructsByDimension.map((g) => g.dimensionId ?? "__none__")),
  );

  const allConstructIds = useMemo(() => {
    const ids: string[] = [];
    for (const group of constructsByDimension) {
      for (const c of group.constructs) {
        ids.push(c.constructId);
      }
    }
    return ids;
  }, [constructsByDimension]);

  const selectedArray = useMemo(() => Array.from(selectedIds), [selectedIds]);
  const estimate = useMemo(
    () => computeEstimate(selectedArray, itemSelectionRules),
    [selectedArray, itemSelectionRules],
  );

  const hasChanges = useMemo(() => {
    if (!isCustom) return false;
    const persistedSet = new Set(currentSelection.selectedConstructIds);
    if (selectedIds.size !== persistedSet.size) return true;
    for (const id of selectedIds) {
      if (!persistedSet.has(id)) return true;
    }
    return false;
  }, [isCustom, selectedIds, currentSelection.selectedConstructIds]);

  const belowMinimum = selectedIds.size < minCustomConstructs;
  const canSave =
    isCustom && selectedIds.size >= minCustomConstructs && hasChanges;

  const toggleConstruct = useCallback((constructId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(constructId)) next.delete(constructId);
      else next.add(constructId);
      return next;
    });
  }, []);

  const toggleDimension = useCallback((dimKey: string) => {
    setExpandedDimensions((prev) => {
      const next = new Set(prev);
      if (next.has(dimKey)) next.delete(dimKey);
      else next.add(dimKey);
      return next;
    });
  }, []);

  const toggleAllInDimension = useCallback(
    (constructs: Array<{ constructId: string }>) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        const allSelected = constructs.every((c) => next.has(c.constructId));
        if (allSelected) {
          for (const c of constructs) next.delete(c.constructId);
        } else {
          for (const c of constructs) next.add(c.constructId);
        }
        return next;
      });
    },
    [],
  );

  async function handleSwitchToFull() {
    if (currentSelection.isCustom || selectedIds.size > 0) {
      setShowClearConfirm(true);
    } else {
      setIsCustom(false);
    }
  }

  async function confirmClearSelection() {
    setSaving(true);
    try {
      await clearConstructSelection(campaignAssessmentId);
      setIsCustom(false);
      setSelectedIds(new Set());
      toast.success("Reverted to full assessment");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to clear selection",
      );
    } finally {
      setSaving(false);
      setShowClearConfirm(false);
    }
  }

  function handleSwitchToCustom() {
    setIsCustom(true);
    if (currentSelection.selectedConstructIds.length > 0) {
      setSelectedIds(new Set(currentSelection.selectedConstructIds));
    }
  }

  async function handleSave() {
    if (hasCompletedParticipants) {
      setShowSaveConfirm(true);
      return;
    }
    await performSave();
  }

  async function performSave() {
    setSaving(true);
    try {
      await saveConstructSelection(campaignAssessmentId, selectedArray);
      toast.success("Construct selection saved");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save selection",
      );
    } finally {
      setSaving(false);
      setShowSaveConfirm(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex items-center gap-3">
        <Switch
          checked={isCustom}
          onCheckedChange={(checked) => {
            if (checked) {
              handleSwitchToCustom();
            } else {
              handleSwitchToFull();
            }
          }}
          aria-label="Toggle custom construct selection"
        />
        <span className="text-sm font-medium">
          {isCustom ? "Custom Selection" : "Full Assessment"}
        </span>
        {!isCustom && (
          <span className="text-xs text-muted-foreground">
            All {allConstructIds.length} constructs included
          </span>
        )}
      </div>

      {/* Construct picker panel (custom mode only) */}
      {isCustom && (
        <div className="space-y-3">
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {constructsByDimension.map((group, groupIndex) => {
                  const dimKey = group.dimensionId ?? "__none__";
                  const isExpanded = expandedDimensions.has(dimKey);
                  const selectedInGroup = group.constructs.filter((c) =>
                    selectedIds.has(c.constructId),
                  ).length;

                  return (
                    <ScrollReveal key={dimKey} delay={groupIndex * 60}>
                      <div>
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50"
                          onClick={() => toggleDimension(dimKey)}
                        >
                          <ChevronRight
                            className={cn(
                              "size-4 text-muted-foreground transition-transform duration-200",
                              isExpanded && "rotate-90",
                            )}
                          />
                          <span className="flex-1 text-sm font-semibold">
                            {group.dimensionName ?? "Uncategorised"}
                          </span>
                          <Badge
                            variant={
                              selectedInGroup > 0 ? "default" : "outline"
                            }
                          >
                            {selectedInGroup} of {group.constructs.length}
                          </Badge>
                          <button
                            type="button"
                            className="text-xs text-primary hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleAllInDimension(group.constructs);
                            }}
                          >
                            {group.constructs.every((c) =>
                              selectedIds.has(c.constructId),
                            )
                              ? "Deselect all"
                              : "Select all"}
                          </button>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-border/50">
                            {group.constructs.map((c) => (
                              <label
                                key={c.constructId}
                                className="flex cursor-pointer items-center gap-3 px-4 py-2.5 pl-11 transition-colors hover:bg-accent/30"
                              >
                                <Checkbox
                                  checked={selectedIds.has(c.constructId)}
                                  onCheckedChange={() =>
                                    toggleConstruct(c.constructId)
                                  }
                                />
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm font-semibold">
                                    {c.constructName}
                                  </span>
                                  {c.constructDescription && (
                                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                                      {c.constructDescription}
                                    </p>
                                  )}
                                </div>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </ScrollReveal>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Summary bar */}
          <div
            className={cn(
              "sticky bottom-0 flex items-center justify-between gap-4 rounded-lg border px-4 py-3",
              "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
              selectedIds.size === 0 && "border-destructive/50",
              belowMinimum &&
                selectedIds.size > 0 &&
                "border-amber-500/50",
            )}
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="font-medium">
                {estimate.constructCount}{" "}
                {estimate.constructCount === 1 ? "construct" : "constructs"}
              </span>
              <span className="text-muted-foreground">
                ~{estimate.estimatedItems} items
              </span>
              <span className="text-muted-foreground">
                Est. {estimate.estimatedMinutes} min
              </span>

              {belowMinimum && (
                <span
                  className={cn(
                    "flex items-center gap-1 text-xs font-medium",
                    selectedIds.size === 0
                      ? "text-destructive"
                      : "text-amber-600",
                  )}
                >
                  <AlertTriangle className="size-3" />
                  Minimum {minCustomConstructs}{" "}
                  {minCustomConstructs === 1 ? "construct" : "constructs"}{" "}
                  required
                </span>
              )}
            </div>

            <Button
              size="sm"
              onClick={handleSave}
              disabled={!canSave || saving}
            >
              {saving ? "Saving..." : "Save Selection"}
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={showClearConfirm}
        onOpenChange={setShowClearConfirm}
        title="Revert to Full Assessment?"
        description="This will remove your custom construct selection. All constructs will be included when participants take this assessment."
        confirmLabel="Revert"
        variant="destructive"
        onConfirm={confirmClearSelection}
        loading={saving}
      />

      <ConfirmDialog
        open={showSaveConfirm}
        onOpenChange={setShowSaveConfirm}
        title="Participants Have Completed"
        description="Some participants have already completed this assessment. Changing the construct selection will affect scoring for future participants but not retroactively."
        confirmLabel="Save Anyway"
        onConfirm={performSave}
        loading={saving}
      />
    </div>
  );
}
