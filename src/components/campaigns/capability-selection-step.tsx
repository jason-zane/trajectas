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

export type FactorAssessmentData = Array<{
  dimensionId: string | null;
  dimensionName: string | null;
  factors: Array<{
    factorId: string;
    factorName: string;
    factorDescription: string | null;
    constructCount: number;
  }>;
}>;

export type ConstructAssessmentData = Array<{
  dimensionId: string | null;
  dimensionName: string | null;
  constructs: Array<{
    constructId: string;
    constructName: string;
    constructDescription: string | null;
  }>;
}>;

type ItemSelectionRules = Array<{
  minConstructs: number;
  maxConstructs: number | null;
  itemsPerConstruct: number;
}>;

type FactorMode = {
  mode: "factor";
  assessmentFactors: FactorAssessmentData;
  selectedIds: string[] | null;
  onSelectionChange: (factorIds: string[] | null) => void;
};

type ConstructMode = {
  mode: "construct";
  assessmentConstructs: ConstructAssessmentData;
  selectedIds: string[] | null;
  onSelectionChange: (constructIds: string[] | null) => void;
};

type CapabilitySelectionStepProps = (FactorMode | ConstructMode) & {
  itemSelectionRules: ItemSelectionRules;
};

// ---------------------------------------------------------------------------
// Normalisation: flatten into one shape so the render path is mode-agnostic
// ---------------------------------------------------------------------------

type Row = {
  id: string;
  name: string;
  description: string | null;
  constructCount: number;
};

type Group = {
  dimensionId: string | null;
  dimensionName: string | null;
  rows: Row[];
};

function normalise(props: CapabilitySelectionStepProps): Group[] {
  if (props.mode === "factor") {
    return props.assessmentFactors.map((group) => ({
      dimensionId: group.dimensionId,
      dimensionName: group.dimensionName,
      rows: group.factors.map((f) => ({
        id: f.factorId,
        name: f.factorName,
        description: f.factorDescription,
        constructCount: f.constructCount,
      })),
    }));
  }

  return props.assessmentConstructs.map((group) => ({
    dimensionId: group.dimensionId,
    dimensionName: group.dimensionName,
    rows: group.constructs.map((c) => ({
      id: c.constructId,
      name: c.constructName,
      description: c.constructDescription,
      constructCount: 1,
    })),
  }));
}

// ---------------------------------------------------------------------------
// Estimate computation (client-side)
// ---------------------------------------------------------------------------

function computeEstimate(
  selectedIds: string[],
  groups: Group[],
  rules: ItemSelectionRules,
) {
  let constructCount = 0;
  for (const group of groups) {
    for (const row of group.rows) {
      if (selectedIds.includes(row.id)) {
        constructCount += row.constructCount;
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
    rowCount: selectedIds.length,
    constructCount,
    estimatedItems,
    estimatedMinutes,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CapabilitySelectionStep(props: CapabilitySelectionStepProps) {
  const groups = useMemo(() => normalise(props), [props]);
  const unit = props.mode === "factor" ? "factor" : "construct";
  const unitPlural = props.mode === "factor" ? "factors" : "constructs";

  const [isCustom, setIsCustom] = useState(props.selectedIds !== null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(props.selectedIds ?? []),
  );
  const [expandedDimensions, setExpandedDimensions] = useState<Set<string>>(
    () => new Set(groups.map((g) => g.dimensionId ?? "__none__")),
  );

  const allRowIds = useMemo(() => {
    const ids: string[] = [];
    for (const group of groups) {
      for (const row of group.rows) {
        ids.push(row.id);
      }
    }
    return ids;
  }, [groups]);

  const selectedArray = useMemo(() => Array.from(selectedIds), [selectedIds]);
  const estimate = useMemo(
    () => computeEstimate(selectedArray, groups, props.itemSelectionRules),
    [selectedArray, groups, props.itemSelectionRules],
  );

  const onSelectionChange = props.onSelectionChange;

  const toggleRow = useCallback(
    (rowId: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(rowId)) {
          next.delete(rowId);
        } else {
          next.add(rowId);
        }
        onSelectionChange(Array.from(next));
        return next;
      });
    },
    [onSelectionChange],
  );

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

  const toggleAllInDimension = useCallback(
    (rows: Row[]) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        const allSelected = rows.every((r) => next.has(r.id));
        if (allSelected) {
          for (const r of rows) next.delete(r.id);
        } else {
          for (const r of rows) next.add(r.id);
        }
        onSelectionChange(Array.from(next));
        return next;
      });
    },
    [onSelectionChange],
  );

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
          aria-label={`Toggle custom ${unit} selection`}
        />
        <span className="text-sm font-medium">
          {isCustom
            ? props.mode === "factor"
              ? "Custom Factors"
              : "Custom Constructs"
            : "Full Assessment"}
        </span>
        {!isCustom && (
          <span className="text-xs text-muted-foreground">
            All {allRowIds.length} {unitPlural} included
          </span>
        )}
      </div>

      {isCustom && (
        <div className="space-y-3">
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {groups.map((group, groupIndex) => {
                  const dimKey = group.dimensionId ?? "__none__";
                  const isExpanded = expandedDimensions.has(dimKey);
                  const selectedInGroup = group.rows.filter((r) =>
                    selectedIds.has(r.id),
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
                            {selectedInGroup} of {group.rows.length}
                          </Badge>
                          <button
                            type="button"
                            className="text-xs text-primary hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleAllInDimension(group.rows);
                            }}
                          >
                            {group.rows.every((r) => selectedIds.has(r.id))
                              ? "Deselect all"
                              : "Select all"}
                          </button>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-border/50">
                            {group.rows.map((row) => (
                              <label
                                key={row.id}
                                className="flex cursor-pointer items-center gap-3 px-4 py-2.5 pl-11 transition-colors hover:bg-accent/30"
                              >
                                <Checkbox
                                  checked={selectedIds.has(row.id)}
                                  onCheckedChange={() => toggleRow(row.id)}
                                />
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm font-semibold">
                                    {row.name}
                                  </span>
                                  {row.description && (
                                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                                      {row.description}
                                    </p>
                                  )}
                                </div>
                                {props.mode === "factor" && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px]"
                                  >
                                    {row.constructCount}{" "}
                                    {row.constructCount === 1
                                      ? "construct"
                                      : "constructs"}
                                  </Badge>
                                )}
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

          <div
            className={cn(
              "flex items-center justify-between gap-4 rounded-lg border px-4 py-3",
              selectedIds.size === 0 && "border-destructive/50",
            )}
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="font-medium">
                {estimate.rowCount} {estimate.rowCount === 1 ? unit : unitPlural}
              </span>
              {props.mode === "factor" && (
                <span className="text-muted-foreground">
                  {estimate.constructCount}{" "}
                  {estimate.constructCount === 1 ? "construct" : "constructs"}
                </span>
              )}
              <span className="text-muted-foreground">
                ~{estimate.estimatedItems} items
              </span>
              <span className="text-muted-foreground">
                Est. {estimate.estimatedMinutes} min
              </span>

              {selectedIds.size === 0 && (
                <span className="flex items-center gap-1 text-xs font-medium text-destructive">
                  <AlertTriangle className="size-3" />
                  At least 1 {unit} required
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
