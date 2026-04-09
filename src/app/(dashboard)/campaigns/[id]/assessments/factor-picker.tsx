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
  saveFactorSelection,
  clearFactorSelection,
} from "@/app/actions/factor-selection";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FactorPickerProps = {
  campaignAssessmentId: string;
  minCustomFactors: number;
  currentSelection: { isCustom: boolean; selectedFactorIds: string[] };
  factorsByDimension: Array<{
    dimensionId: string | null;
    dimensionName: string | null;
    factors: Array<{
      factorId: string;
      factorName: string;
      factorDescription: string | null;
      constructCount: number;
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
// Estimate computation (client-side)
// ---------------------------------------------------------------------------

function computeEstimate(
  selectedFactorIds: string[],
  factorsByDimension: FactorPickerProps["factorsByDimension"],
  rules: FactorPickerProps["itemSelectionRules"],
) {
  let constructCount = 0;
  for (const group of factorsByDimension) {
    for (const factor of group.factors) {
      if (selectedFactorIds.includes(factor.factorId)) {
        constructCount += factor.constructCount;
      }
    }
  }

  const rule = rules.find(
    (r) =>
      constructCount >= r.minConstructs &&
      (r.maxConstructs === null || constructCount <= r.maxConstructs),
  );
  const itemsPerConstruct = rule?.itemsPerConstruct ?? 6;
  const estimatedItems = constructCount * itemsPerConstruct;
  const estimatedMinutes = Math.ceil((estimatedItems * 8) / 60);

  return {
    factorCount: selectedFactorIds.length,
    constructCount,
    estimatedItems,
    estimatedMinutes,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FactorPicker({
  campaignAssessmentId,
  minCustomFactors,
  currentSelection,
  factorsByDimension,
  itemSelectionRules,
  hasCompletedParticipants = false,
}: FactorPickerProps) {
  const router = useRouter();

  // Mode: full assessment vs custom selection
  const [isCustom, setIsCustom] = useState(currentSelection.isCustom);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(currentSelection.selectedFactorIds),
  );
  const [saving, setSaving] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [expandedDimensions, setExpandedDimensions] = useState<Set<string>>(
    () => new Set(factorsByDimension.map((g) => g.dimensionId ?? "__none__")),
  );

  // All factor IDs for convenience
  const allFactorIds = useMemo(() => {
    const ids: string[] = [];
    for (const group of factorsByDimension) {
      for (const factor of group.factors) {
        ids.push(factor.factorId);
      }
    }
    return ids;
  }, [factorsByDimension]);

  // Estimate
  const selectedArray = useMemo(() => Array.from(selectedIds), [selectedIds]);
  const estimate = useMemo(
    () => computeEstimate(selectedArray, factorsByDimension, itemSelectionRules),
    [selectedArray, factorsByDimension, itemSelectionRules],
  );

  // Check if selection has changed from persisted state
  const hasChanges = useMemo(() => {
    if (!isCustom) return false;
    const persistedSet = new Set(currentSelection.selectedFactorIds);
    if (selectedIds.size !== persistedSet.size) return true;
    for (const id of selectedIds) {
      if (!persistedSet.has(id)) return true;
    }
    return false;
  }, [isCustom, selectedIds, currentSelection.selectedFactorIds]);

  const belowMinimum = selectedIds.size < minCustomFactors;
  const canSave = isCustom && selectedIds.size >= minCustomFactors && hasChanges;

  // Toggle factor selection
  const toggleFactor = useCallback((factorId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(factorId)) {
        next.delete(factorId);
      } else {
        next.add(factorId);
      }
      return next;
    });
  }, []);

  // Toggle dimension section expand/collapse
  const toggleDimension = useCallback((dimKey: string) => {
    setExpandedDimensions((prev) => {
      const next = new Set(prev);
      if (next.has(dimKey)) {
        next.delete(dimKey);
      } else {
        next.add(dimKey);
      }
      return next;
    });
  }, []);

  // Select/deselect all factors in a dimension
  const toggleAllInDimension = useCallback(
    (factors: Array<{ factorId: string }>) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        const allSelected = factors.every((f) => next.has(f.factorId));
        if (allSelected) {
          for (const f of factors) next.delete(f.factorId);
        } else {
          for (const f of factors) next.add(f.factorId);
        }
        return next;
      });
    },
    [],
  );

  // Mode switch handlers
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
      await clearFactorSelection(campaignAssessmentId);
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
    if (currentSelection.selectedFactorIds.length > 0) {
      setSelectedIds(new Set(currentSelection.selectedFactorIds));
    }
  }

  // Save handler
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
      await saveFactorSelection(campaignAssessmentId, selectedArray);
      toast.success("Factor selection saved");
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
          aria-label="Toggle custom factor selection"
        />
        <span className="text-sm font-medium">
          {isCustom ? "Custom Selection" : "Full Assessment"}
        </span>
        {!isCustom && (
          <span className="text-xs text-muted-foreground">
            All {allFactorIds.length} factors included
          </span>
        )}
      </div>

      {/* Factor picker panel (custom mode only) */}
      {isCustom && (
        <div className="space-y-3">
          {/* Dimension groups */}
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {factorsByDimension.map((group, groupIndex) => {
                  const dimKey = group.dimensionId ?? "__none__";
                  const isExpanded = expandedDimensions.has(dimKey);
                  const selectedInGroup = group.factors.filter((f) =>
                    selectedIds.has(f.factorId),
                  ).length;

                  return (
                    <ScrollReveal key={dimKey} delay={groupIndex * 60}>
                      <div>
                        {/* Dimension header */}
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
                            {selectedInGroup} of {group.factors.length}
                          </Badge>
                          <button
                            type="button"
                            className="text-xs text-primary hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleAllInDimension(group.factors);
                            }}
                          >
                            {group.factors.every((f) =>
                              selectedIds.has(f.factorId),
                            )
                              ? "Deselect all"
                              : "Select all"}
                          </button>
                        </button>

                        {/* Factor rows */}
                        {isExpanded && (
                          <div className="border-t border-border/50">
                            {group.factors.map((factor) => (
                              <label
                                key={factor.factorId}
                                className="flex cursor-pointer items-center gap-3 px-4 py-2.5 pl-11 transition-colors hover:bg-accent/30"
                              >
                                <Checkbox
                                  checked={selectedIds.has(factor.factorId)}
                                  onCheckedChange={() =>
                                    toggleFactor(factor.factorId)
                                  }
                                />
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm font-semibold">
                                    {factor.factorName}
                                  </span>
                                  {factor.factorDescription && (
                                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                                      {factor.factorDescription}
                                    </p>
                                  )}
                                </div>
                                <Badge variant="outline" className="text-[10px]">
                                  {factor.constructCount}{" "}
                                  {factor.constructCount === 1
                                    ? "construct"
                                    : "constructs"}
                                </Badge>
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
                "border-amber-500/50 dark:border-amber-400/50",
            )}
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="font-medium">
                {estimate.factorCount}{" "}
                {estimate.factorCount === 1 ? "factor" : "factors"}
              </span>
              <span className="text-muted-foreground">
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
                      : "text-amber-600 dark:text-amber-400",
                  )}
                >
                  <AlertTriangle className="size-3" />
                  Minimum {minCustomFactors}{" "}
                  {minCustomFactors === 1 ? "factor" : "factors"} required
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

      {/* Confirm dialog: revert to full assessment */}
      <ConfirmDialog
        open={showClearConfirm}
        onOpenChange={setShowClearConfirm}
        title="Revert to Full Assessment?"
        description="This will remove your custom factor selection. All factors will be included when participants take this assessment."
        confirmLabel="Revert"
        variant="destructive"
        onConfirm={confirmClearSelection}
        loading={saving}
      />

      {/* Confirm dialog: save with completed participants */}
      <ConfirmDialog
        open={showSaveConfirm}
        onOpenChange={setShowSaveConfirm}
        title="Participants Have Completed"
        description="Some participants have already completed this assessment. Changing the factor selection will affect scoring for future participants but not retroactively."
        confirmLabel="Save Anyway"
        onConfirm={performSave}
        loading={saving}
      />
    </div>
  );
}
