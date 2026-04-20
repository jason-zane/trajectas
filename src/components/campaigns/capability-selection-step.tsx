"use client";

import { useState, useMemo, useCallback } from "react";
import { ChevronRight, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollReveal } from "@/components/scroll-reveal";
import { estimateAssessmentDurationMinutes } from "@/lib/assessments/duration";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CapabilitySelectionStepProps = {
  assessmentFactors: Array<{
    dimensionId: string | null;
    dimensionName: string | null;
    factors: Array<{
      factorId: string;
      factorName: string;
      factorDescription: string | null;
      constructCount: number;
    }>;
  }>;
  selectedFactorIds: string[] | null;
  onSelectionChange: (factorIds: string[] | null) => void;
  itemSelectionRules: Array<{
    minConstructs: number;
    maxConstructs: number | null;
    itemsPerConstruct: number;
  }>;
};

// ---------------------------------------------------------------------------
// Estimate computation (client-side)
// ---------------------------------------------------------------------------

function computeEstimate(
  selectedFactorIds: string[],
  assessmentFactors: CapabilitySelectionStepProps["assessmentFactors"],
  rules: CapabilitySelectionStepProps["itemSelectionRules"],
) {
  let constructCount = 0;
  for (const group of assessmentFactors) {
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
  const estimatedMinutes = estimateAssessmentDurationMinutes(estimatedItems);

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

export function CapabilitySelectionStep({
  assessmentFactors,
  selectedFactorIds,
  onSelectionChange,
  itemSelectionRules,
}: CapabilitySelectionStepProps) {
  // Mode: full assessment vs custom selection
  const [isCustom, setIsCustom] = useState(selectedFactorIds !== null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(selectedFactorIds ?? []),
  );
  const [expandedDimensions, setExpandedDimensions] = useState<Set<string>>(
    () => new Set(assessmentFactors.map((g) => g.dimensionId ?? "__none__")),
  );

  // All factor IDs for convenience
  const allFactorIds = useMemo(() => {
    const ids: string[] = [];
    for (const group of assessmentFactors) {
      for (const factor of group.factors) {
        ids.push(factor.factorId);
      }
    }
    return ids;
  }, [assessmentFactors]);

  // Estimate
  const selectedArray = useMemo(() => Array.from(selectedIds), [selectedIds]);
  const estimate = useMemo(
    () => computeEstimate(selectedArray, assessmentFactors, itemSelectionRules),
    [selectedArray, assessmentFactors, itemSelectionRules],
  );

  // Toggle factor selection
  const toggleFactor = useCallback((factorId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(factorId)) {
        next.delete(factorId);
      } else {
        next.add(factorId);
      }
      onSelectionChange(Array.from(next));
      return next;
    });
  }, [onSelectionChange]);

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
        onSelectionChange(Array.from(next));
        return next;
      });
    },
    [onSelectionChange],
  );

  // Mode switch handlers
  function handleSwitchToFull() {
    setIsCustom(false);
    setSelectedIds(new Set());
    onSelectionChange(null);
  }

  function handleSwitchToCustom() {
    setIsCustom(true);
    onSelectionChange(Array.from(selectedIds));
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
          {isCustom ? "Custom Factors" : "Full Assessment"}
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
                {assessmentFactors.map((group, groupIndex) => {
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
              "flex items-center justify-between gap-4 rounded-lg border px-4 py-3",
              selectedIds.size === 0 && "border-destructive/50",
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

              {selectedIds.size === 0 && (
                <span className="flex items-center gap-1 text-xs font-medium text-destructive">
                  <AlertTriangle className="size-3" />
                  At least 1 factor required
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
