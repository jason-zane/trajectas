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
  ActionDialog,
  ActionDialogBody,
} from "@/components/action-dialog";
import { Switch } from "@/components/ui/switch";
import {
  addAssessmentToCampaign,
  removeAssessmentFromCampaign,
} from "@/app/actions/campaigns";
import { FactorPicker } from "./factor-picker";
import { ConstructPicker } from "./construct-picker";
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

export type ConstructPickerData = {
  campaignAssessmentId: string;
  constructsByDimension: Array<{
    dimensionId: string | null;
    dimensionName: string | null;
    constructs: Array<{
      constructId: string;
      constructName: string;
      constructDescription: string | null;
    }>;
  }>;
  currentSelection: { isCustom: boolean; selectedConstructIds: string[] };
  minCustomConstructs: number;
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
  minCustomConstructs: number | null;
  scoringLevel: 'factor' | 'construct';
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
  constructPickerDataMap = {},
  itemSelectionRules = [],
  hasCompletedParticipants = false,
}: {
  campaignId: string;
  linkedAssessments: LinkedAssessment[];
  allAssessments: AvailableAssessment[];
  factorPickerDataMap?: Record<string, FactorPickerData>;
  constructPickerDataMap?: Record<string, ConstructPickerData>;
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
            const factorPicker = factorPickerDataMap[la.id];
            const constructPicker = constructPickerDataMap[la.id];
            const isConstructLevel = la.scoringLevel === "construct";
            const hasFactorCustomisation =
              !isConstructLevel && la.minCustomFactors != null && factorPicker;
            const hasConstructCustomisation =
              isConstructLevel && la.minCustomConstructs != null && constructPicker;
            const hasCustomisation = hasFactorCustomisation || hasConstructCustomisation;
            const isPickerExpanded = expandedFactorPickers.has(la.id);

            // Determine the selection status label
            let statusLabel: string | null = null;
            let statusIsCustom = false;
            if (hasFactorCustomisation) {
              statusIsCustom = factorPicker.currentSelection.isCustom;
              statusLabel = statusIsCustom
                ? `Custom (${factorPicker.currentSelection.selectedFactorIds.length} factors)`
                : "Full Assessment";
            } else if (hasConstructCustomisation) {
              statusIsCustom = constructPicker.currentSelection.isCustom;
              statusLabel = statusIsCustom
                ? `Custom (${constructPicker.currentSelection.selectedConstructIds.length} constructs)`
                : "Full Assessment";
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
                        {statusLabel && (
                          <Badge
                            variant={statusIsCustom ? "default" : "secondary"}
                            className="text-[10px]"
                          >
                            {statusLabel}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {hasCustomisation && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => toggleFactorPicker(la.id)}
                      >
                        <SlidersHorizontal className="size-3.5" />
                        <span className="hidden sm:inline">
                          {isConstructLevel ? "Constructs" : "Factors"}
                        </span>
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

                  {/* Picker expansion — branch based on scoring level */}
                  {hasFactorCustomisation && isPickerExpanded && (
                    <div className="mt-4 border-t pt-4">
                      <FactorPicker
                        campaignAssessmentId={la.id}
                        minCustomFactors={factorPicker.minCustomFactors}
                        currentSelection={factorPicker.currentSelection}
                        factorsByDimension={factorPicker.factorsByDimension}
                        itemSelectionRules={itemSelectionRules}
                        hasCompletedParticipants={hasCompletedParticipants}
                      />
                    </div>
                  )}
                  {hasConstructCustomisation && isPickerExpanded && (
                    <div className="mt-4 border-t pt-4">
                      <ConstructPicker
                        campaignAssessmentId={la.id}
                        minCustomConstructs={constructPicker.minCustomConstructs}
                        currentSelection={constructPicker.currentSelection}
                        constructsByDimension={constructPicker.constructsByDimension}
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

      <ActionDialog
        open={showPicker}
        onOpenChange={setShowPicker}
        eyebrow="Add to campaign"
        title="Add assessment"
        description="Link an existing assessment to this campaign. Participants will take every linked assessment."
      >
        <ActionDialogBody className="space-y-4">
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
            <p className="py-4 text-center text-sm text-muted-foreground">
              {available.length === 0
                ? "All available assessments are already linked."
                : "No assessments match the current filter."}
            </p>
          ) : (
            <div className="space-y-2">
              {visibleAvailable.map((a) => (
                <button
                  key={a.id}
                  onClick={() => handleAdd(a.id)}
                  className="flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:border-primary/60 hover:bg-primary/5"
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
        </ActionDialogBody>
      </ActionDialog>
    </div>
  );
}
