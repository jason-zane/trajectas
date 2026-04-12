"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  GripVertical,
  Trash2,
  ClipboardList,
  ChevronDown,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  addAssessmentToCampaign,
  removeAssessmentFromCampaign,
} from "@/app/actions/campaigns";
import { FactorPicker } from "./factor-picker";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export type FactorPickerData = {
  campaignAssessmentId: string;
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
  currentSelection: { isCustom: boolean; selectedFactorIds: string[] };
  minCustomFactors: number;
};

type LinkedAssessment = {
  id: string;
  campaignId: string;
  assessmentId: string;
  displayOrder: number;
  isRequired: boolean;
  assessmentTitle: string;
  assessmentStatus: string;
  minCustomFactors: number | null;
  created_at: string;
};

type AvailableAssessment = {
  id: string;
  title: string;
  status: string;
  formatLabel?: string;
  description?: string;
  factorCount?: number;
  sectionCount?: number;
  totalItemCount?: number;
  estimatedDurationMinutes?: number;
  quotaLimit?: number | null;
  quotaUsed?: number;
  quotaRemaining?: number | null;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CampaignAssessmentsList({
  campaignId,
  linkedAssessments,
  allAssessments,
  factorPickerDataMap = {},
  itemSelectionRules = [],
  hasCompletedParticipants = false,
}: {
  campaignId: string;
  linkedAssessments: LinkedAssessment[];
  allAssessments: AvailableAssessment[];
  factorPickerDataMap?: Record<string, FactorPickerData>;
  itemSelectionRules?: Array<{
    minConstructs: number;
    maxConstructs: number | null;
    itemsPerConstruct: number;
  }>;
  hasCompletedParticipants?: boolean;
}) {
  const router = useRouter();
  const [showPicker, setShowPicker] = useState(false);
  const [showDrafts, setShowDrafts] = useState(false);
  const [expandedFactorPickers, setExpandedFactorPickers] = useState<
    Set<string>
  >(new Set());

  const linkedIds = new Set(linkedAssessments.map((a) => a.assessmentId));
  const available = allAssessments.filter((a) => !linkedIds.has(a.id));
  const visibleAvailable = available.filter(
    (assessment) => showDrafts || assessment.status !== "draft",
  );

  function getAssessmentSummary(assessment: AvailableAssessment) {
    const parts = [
      assessment.factorCount != null
        ? `${assessment.factorCount} factor${assessment.factorCount === 1 ? "" : "s"}`
        : null,
      assessment.sectionCount != null
        ? `${assessment.sectionCount} section${assessment.sectionCount === 1 ? "" : "s"}`
        : null,
      assessment.totalItemCount != null
        ? `${assessment.totalItemCount} item${assessment.totalItemCount === 1 ? "" : "s"}`
        : null,
      assessment.estimatedDurationMinutes != null
        ? `${assessment.estimatedDurationMinutes} min`
        : null,
    ].filter(Boolean);

    return parts.join(" · ");
  }

  async function handleAdd(assessmentId: string) {
    const result = await addAssessmentToCampaign(campaignId, assessmentId);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Assessment added");
    setShowPicker(false);
    router.refresh();
  }

  async function handleRemove(assessmentId: string) {
    const result = await removeAssessmentFromCampaign(
      campaignId,
      assessmentId,
    );
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Assessment removed");
    router.refresh();
  }

  function toggleFactorPicker(campaignAssessmentId: string) {
    setExpandedFactorPickers((prev) => {
      const next = new Set(prev);
      if (next.has(campaignAssessmentId)) {
        next.delete(campaignAssessmentId);
      } else {
        next.add(campaignAssessmentId);
      }
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">
          {linkedAssessments.length}{" "}
          {linkedAssessments.length === 1 ? "assessment" : "assessments"}
        </h3>
        <Button size="sm" onClick={() => setShowPicker(true)}>
          <Plus className="size-4" />
          Add Assessment
        </Button>
      </div>

      {linkedAssessments.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No assessments linked yet. Add assessments to include them in this
            campaign.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {linkedAssessments.map((la, index) => {
            const pickerData = factorPickerDataMap[la.id];
            const hasFactorCustomisation =
              la.minCustomFactors != null && pickerData;
            const isPickerExpanded = expandedFactorPickers.has(la.id);

            // Determine the factor selection status label
            let factorStatusLabel: string | null = null;
            if (hasFactorCustomisation) {
              if (pickerData.currentSelection.isCustom) {
                factorStatusLabel = `Custom (${pickerData.currentSelection.selectedFactorIds.length} factors)`;
              } else {
                factorStatusLabel = "Full Assessment";
              }
            }

            return (
              <Card key={la.id}>
                <CardContent className="py-3">
                  <div className="flex items-center gap-3">
                    <GripVertical className="size-4 text-muted-foreground/50 cursor-grab" />
                    <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                      <ClipboardList className="size-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {la.assessmentTitle}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-[10px]">
                          {la.assessmentStatus}
                        </Badge>
                        {la.isRequired && (
                          <span className="text-[10px] text-muted-foreground">
                            Required
                          </span>
                        )}
                        {factorStatusLabel && (
                          <Badge
                            variant={
                              pickerData.currentSelection.isCustom
                                ? "default"
                                : "secondary"
                            }
                            className="text-[10px]"
                          >
                            {factorStatusLabel}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {hasFactorCustomisation && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => toggleFactorPicker(la.id)}
                      >
                        <SlidersHorizontal className="size-3.5" />
                        <span className="hidden sm:inline">Factors</span>
                        <ChevronDown
                          className={cn(
                            "size-3 transition-transform duration-200",
                            isPickerExpanded && "rotate-180",
                          )}
                        />
                      </Button>
                    )}

                    <span className="text-xs text-muted-foreground">
                      #{index + 1}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemove(la.assessmentId)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>

                  {/* Factor picker expansion */}
                  {hasFactorCustomisation && isPickerExpanded && (
                    <div className="mt-4 border-t pt-4">
                      <FactorPicker
                        campaignAssessmentId={la.id}
                        minCustomFactors={pickerData.minCustomFactors}
                        currentSelection={pickerData.currentSelection}
                        factorsByDimension={pickerData.factorsByDimension}
                        itemSelectionRules={itemSelectionRules}
                        hasCompletedParticipants={hasCompletedParticipants}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Picker dialog */}
      <Dialog open={showPicker} onOpenChange={setShowPicker}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Assessment</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
            <div>
              <p className="text-sm font-medium">Show draft assessments</p>
              <p className="text-xs text-muted-foreground">
                Published assessments stay visible by default.
              </p>
            </div>
            <Switch checked={showDrafts} onCheckedChange={setShowDrafts} />
          </div>
          {visibleAvailable.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {available.length === 0
                ? "All available assessments are already linked."
                : "No assessments match the current filter."}
            </p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {visibleAvailable.map((a) => (
                <button
                  key={a.id}
                  onClick={() => handleAdd(a.id)}
                  className="flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent"
                >
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                    <ClipboardList className="size-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{a.title}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {a.status === "active" ? "Published" : "Draft"}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {a.formatLabel}
                      </Badge>
                    </div>
                    {a.description && (
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {a.description}
                      </p>
                    )}
                    {getAssessmentSummary(a) && (
                      <p className="text-xs text-muted-foreground">
                        {getAssessmentSummary(a)}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
